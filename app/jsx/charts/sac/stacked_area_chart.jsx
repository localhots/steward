var StackedAreaChart = React.createClass({
    mixins: [ReactRouter.Navigation, ReactRouter.State, SVGChartMixin, ChartDataMixin],

    canvasHeight: 350,
    xAxisHeight: 20,

    maxItems: 10,
    maxWeeks: 30,

    words: {
        actions: { // Item
            repo: "made to",
            team: "made by the most active",
            user: "made by the most active"
        },
        items: { // Item
            repo: "repositories",
            team: "teams",
            user: "users"
        },
        whatHappened: { // Item-Target
            "user-repo": "working on",
            "team-repo": "working on",
            "team-org": "to repositories of",
            "user-org": "to repositories of",
            "repo-org": "that were most actively modified by the members of",
            "user-team": "working on repositories of the",
            "repo-team": "that were most actively modified by the members of the",
            "repo-user": "that were most actively modified by"
        },
        targetSuffix: { // Subject of current context
            repo: "repository",
            team: "team"
        },
    },

    getInitialState: function() {
        return {
            item: this.props.items[0],
            rawData: [],
            topItems: [],
            weeklyData: [],
            maxCommitsPerWeek: 1
        };
    },

    componentDidMount: function() {
        this.calculateViewBoxWidth();
        window.addEventListener('resize', this.calculateViewBoxWidth);
    },

    componentWillReceiveProps: function(newProps) {
        // If new items are the same as old then don't reset current item
        this.setState({
            item: (_.isEqual(newProps.items, this.props.items)
                ? this.state.item
                : newProps.items[0]),
            state: 'loadingData'
        }, this.fetchData);
    },

    shouldComponentUpdate: function(newProps, newState) {
        // Don't re-render unless canvas width is calculated
        if (!newState.canvasWidth) {
            return false;
        }
        // We're working with animations here so we render only in one particular state
        if (newState.state !== 'pleaseRender')  {
            return false;
        }
        return true;
    },

    handleFilter: function(thing, i) {
        if (this.props.items[i] !== this.state.item) {
            this.setState({
                item: this.props.items[i],
                state: 'loadingData'
            }, this.fetchData);
        }
    },

    handleClick: function(item) {
        this.handleFocusOut();
        var params = {org: this.getParams().org};
        params[this.state.item] = item;
        this.transitionTo(this.state.item, params, this.getQuery());
    },

    handleFocusIn: function(i) {
        var node = this.refs.container.getDOMNode();
        node.className = 'sac focused item-'+ i;
    },

    handleFocusOut: function() {
        var node = this.refs.container.getDOMNode();
        node.className = 'sac';
    },

    handleNewData: function() {
        // [week, ...]
        var weeksList = _(this.state.rawData).pluck('week').uniq().sort().reverse().take(this.maxWeeks).value();
        if (weeksList.length < 2) {
            this.setState({
                topItems: [],
                weeklyData: {},
                maxCommitsPerWeek: 0,
                state: 'pleaseRender'
            });
            return;
        }

        // {item: commits, ...}
        var commitsByItem = _.reduce(this.state.rawData, function(res, el) {
            if (weeksList.indexOf(el.week) === -1) {
                return res;
            }
            if (res[el.item] === undefined) {
                res[el.item] = el.commits;
            } else {
                res[el.item] += el.commits;
            }
            return res;
        }, {});

        // [item, ...]
        var topItems = _(_.pairs(commitsByItem)) // Take [item, count] pairs from counts object
            .sortBy(1).reverse() // sort them by count (descending)
            .take(this.maxItems) // take first N pairs
            .pluck(0) // keep only items, omit the counts
            .value();
        for (var i = topItems.length; i < this.maxItems; i++) {
            topItems[i] = null;
        };

        // {week: {item: commits, ...}, ...}
        var weeklyData = _.reduce(this.state.rawData, function(res, el) {
            if (weeksList.indexOf(el.week) === -1) {
                return res;
            }
            if (res[el.week] === undefined) {
                res[el.week] = {};
            }
            if (topItems.indexOf(el.item) > -1) {
                res[el.week][el.item] = el.commits;
            }
            return res;
        }, {});

        var maxCommitsPerWeek = _.max(_.map(weeksList, function(week) {
            return _.sum(_.values(weeklyData[week]));
        }));

        this.setState({
            topItems: topItems,
            weeklyData: weeklyData,
            maxCommitsPerWeek: maxCommitsPerWeek,
            state: 'pleaseRender'
        });
    },

    buildPathD: function(dots) {
        var maxWidth = this.state.canvasWidth,
            maxHeight = this.canvasHeight;

        var dots = this.extendDotsWithCoordinates(dots);
        var first = dots.shift(); // Don't draw a line to the first dot, it should be a move
        var d = _.map(dots, function(dot){ return 'L'+ dot.x +','+ dot.y; });
        d.unshift('M'+ first.x +','+ first.y); // Prepend first move
        d.push('L'+ maxWidth +','+ maxHeight); // Draw a line to the bottom right corner
        d.push('L0,'+ maxHeight +' Z'); // And then to a bottom left corner

        return d.join(' ');
    },

    extendDotsWithCoordinates: function(dots) {
        var maxWidth = this.state.canvasWidth,
            maxHeight = this.canvasHeight,
            maxValue = this.state.maxCommitsPerWeek,
            len = dots.length;

        return _.map(dots, function(dot, i) {
            dot.x = i/(len-1)*maxWidth;
            dot.y = maxHeight - dot.norm*maxHeight*0.96;
            return dot;
        });
    },

    render: function() {
        var renderArea = function(pair, i) {
            var item = pair[0], path = pair[1];
            // NOTE: Rounded bottom corners is a side-effect
            return (
                <Area key={'area-'+ i}
                    item={item} i={i}
                    d={roundPathCorners(this.buildPathD(path), 3)}
                    color={Colors[i]}
                    onClick={this.handleClick.bind(this, item)}
                    onMouseOver={this.handleFocusIn.bind(this, i)} />
            );
        }.bind(this);

        var renderDot = function(item, i, dot, j) {
            if (dot.val === 0) {
                return null;
            }

            var maxWidth = this.state.canvasWidth,
                maxHeight = this.canvasHeight,
                radius = 10,
                x = dot.x,
                y = dot.y;

            if (x < radius) {
                x = radius
            } else if (x > maxWidth - radius) {
                x = maxWidth - radius;
            }
            if (y < radius) {
                y = radius;
            } else if (y > maxHeight - radius) {
                y = maxHeight - radius;
            }

            return (
                <Dot key={'dot-'+ i +'-'+ j}
                    item={item} i={i}
                    value={dot.val}
                    x={x}
                    y={y}
                    onMouseOver={this.handleFocusIn.bind(this, i)} />
            );
        }.bind(this);

        var renderLegend = function(item, i){
            return (
                <li key={'legend-'+ item}
                    className={'label label-'+ i}
                    onMouseOver={this.handleFocusIn.bind(this, i)}
                    onMouseOut={this.handleFocusOut.bind(this, i)}
                    onClick={this.handleClick.bind(this, item)}
                    >
                    <div className="color-dot" style={{backgroundColor: Colors[i]}}></div>
                    {item}
                </li>
            );
        }.bind(this);

        var maxWidth = this.state.canvasWidth,
            maxHeight = this.canvasHeight,
            top = this.state.topItems,
            max = this.state.maxCommitsPerWeek;

        // [week, [dot, ...]]
        var dotsByWeek = _(this.state.weeklyData)
            .map(function(items, week) {
                var values = _.map(top, function(item) {
                    return items[item] || 0;
                });
                var sum = 0;
                var dots = _.map(values, function(val) {
                    sum += val/max;
                    return {
                        val: val,
                        norm: sum
                    };
                });
                return [parseInt(week, 10), dots];
            })
            .sort(0)
            .reverse()
            .take(this.maxWeeks)
            .reverse()
            .value();

        // [item, [dot, ...]]
        var dotsByItem = _.map(top, function(item, i) {
            var dots = _.map(dotsByWeek, function(pair) {
                var dots = pair[1];
                return dots[i];
            });
            return[item, dots];
        });

        var renderedDots = _.map(dotsByItem, function(pair, i) {
            var item = pair[0], path = pair[1];
            var dots = this.extendDotsWithCoordinates(path);
            return dots.map(renderDot.bind(this, item, i));
        }.bind(this));

        var legend = _(dotsByItem).pluck(0).filter(function(el){ return el !== null; }).value();

        // Text generation stuff
        var words = this.words,
            target = (this.getParams().repo ? 'repo'
                : this.getParams().team ? 'team'
                : this.getParams().user ? 'user'
                : 'org');
            subject = this.getParams()[target];

        return (
            <div ref="container" className="sac">
                <div className="whatsgoingon">
                    This stacked area chart shows <em>the number of commits</em> {words.actions[this.state.item]} <em>{words.items[this.state.item]}</em> {words.whatHappened[this.state.item +'-'+ target]} <em>{subject}</em> {words.targetSuffix[target]}<br /><WeekIntervalSelector org={this.getParams().org} />
                </div>
                <div className="filters">
                    <Selector thing="sort"
                        title="Show"
                        items={['commits']}
                        value={'commits'} />
                    <Selector thing="item"
                        title="Grouped by"
                        items={this.props.items}
                        value={this.state.item}
                        onChange={this.handleFilter.bind(this, 'item')} />
                </div>
                <svg ref="svg" className="sachart" key="sachart-svg"
                    width="100%"
                    height={this.canvasHeight + this.xAxisHeight}
                    viewBox={"0 0 "+ (this.state.canvasWidth || 0) + " "+ (this.canvasHeight + this.xAxisHeight)}
                    onMouseOut={this.handleFocusOut}
                    >
                    <g ref="areas">{dotsByItem.map(renderArea).reverse()}</g>
                    <g ref="dots">{renderedDots}</g>
                    <Axis
                        weeks={_.pluck(dotsByWeek, 0)}
                        y={this.canvasHeight}
                        width={this.state.canvasWidth}
                        height={this.xAxisHeight} />
                </svg>
                <ul className="legend">
                    {legend.map(renderLegend)}
                </ul>
            </div>
        );
    }
});
