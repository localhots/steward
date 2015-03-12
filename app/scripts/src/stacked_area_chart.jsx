var StackedAreaChart = React.createClass({
    mixins: [Router.Navigation, Router.State, Chart],

    numElements: 10,
    maxWeeks: 20,
    height: 250,

    getInitialState: function() {
        return {
            currentApi: null,
            currentParams: null,
            item: this.props.items[0],
            rawData: [],
            top: [],
            max: 1,
            weeks: [],
            canvasWidth: 0,
            state: 'initial'
        };
    },

    componentDidMount: function() {
        this.fetchData();
        this.calculateViewBoxWidth();
        window.addEventListener('resize', this.calculateViewBoxWidth);
    },

    componentWillReceiveProps: function(newProps) {
        this.setState({
            item: newProps.items[0],
            sort: 'commits',
            state: 'newProps'
        }, this.fetchData);
    },

    shouldComponentUpdate: function(newProps, newState) {
        // console.log("Should update?", newState.state);
        if (newState.canvasWidth === 0) {
            return false;
        }
        if (newState.state !== 'newPoints')  {
            return false;
        }
        // console.log("Updating!");
        return true;
    },

    handleFilter: function(thing, i) {
        if (this.props.items[i] !== this.state.item) {
            this.setState({
                item: this.props.items[i],
                state: 'newProps'
            }, this.fetchData);
        }
    },

    handleClick: function(point) {
        var params = {org: this.getParams().org};
        params[this.state.item] = point.item;
        this.transitionTo(this.state.item, params);
    },

    fetchData: function() {
        if (!this.apiParams().item) {
            return;
        }
        if (this.state.currentApi === this.props.api &&
            this.state.currentParams === JSON.stringify(this.apiParams())) {
            return;
        }

        // console.log('-----> fetching', this.props.api, this.state.item);
        this.setState({
            currentApi: this.props.api,
            currentParams: JSON.stringify(this.apiParams()),
            state: 'loadingData'
        }, function() {
            $.get(this.props.api, this.apiParams(), function(res){
                this.setState({
                    rawData: res,
                    state: 'newData'
                }, this.buildPoints);
            }.bind(this));
        }.bind(this));
    },

    apiParams: function() {
        var params = _.clone(this.props.params);
        params['item'] = this.state.item;
        return params;
    },

    buildPoints: function() {
        // Group commits by items
        var counts = _.reduce(this.state.rawData, function(res, el) {
            if (res[el.item] === undefined) {
                res[el.item] = el.commits;
            } else {
                res[el.item] += el.commits;
            }
            return res;
        }, {});

        // Extract top items from
        var top = _.chain(_.pairs(counts)) // Take [item, count] pairs from counts object
            .sortBy(1).reverse() // sort them by count (descending)
            .take(this.numElements) // take first N pairs
            .pluck(0) // keep only items, omit the counts
            .value();

        var weeks = _.reduce(this.state.rawData, function(res, el) {
            if (res[el.week] === undefined) {
                res[el.week] = {};
            }
            if (top.indexOf(el.item) > -1) {
                res[el.week][el.item] = el.commits;
            }
            return res;
        }, {});
        var max = _.chain(weeks).keys().sort().reverse().take(15).map(function(week) {
            return _.sum(_.values(weeks[week]));
        })
        .max()
        .value();

        // var max = _.max(_.map(weeks, function(items, week) {
        //         return _.sum(_.values(items));
        //     }));

        // console.log("New points!");
        this.setState({
            top: top,
            max: max,
            weeks: weeks,
            state: 'newPoints'
        });
    },

    buildPathD: function(points) {
        var maxWidth = this.state.canvasWidth,
            maxHeight = this.height,
            maxValue = this.state.max,
            len = points.length;
        var d = _.map(points, function(point, i) {
            return 'L'+ Math.floor(i/len*maxWidth) +','+ Math.floor(maxHeight - point);
        });
        d.unshift('M0,'+ maxHeight);
        d.push('L'+ maxWidth +','+ maxHeight +'Z');

        return d.join(' ');
    },

    render: function() {
        // console.log("Rendering!");
        var maxWidth = this.state.canvasWidth,
            maxHeight = this.height,
            rtop = this.state.top.reverse(),
            max = this.state.max;

        var points = _.chain(this.state.weeks)
            .map(function(items, week) {
                var values = _.map(rtop, function(item) {
                    return items[item] || 0;
                });

                var sum = 0;
                // console.log('----------');
                var points = _.map(values, function(val) {
                    sum += Math.floor(val/max*maxHeight);
                    // console.log(val, max, maxHeight, sum);
                    return sum;
                });

                return [week, points];
            })
            .sort(0)
            .reverse()
            .take(this.maxWeeks)
            .reverse()
            .value();

        var paths = _.reduce(rtop, function(res, item, i) {
            res[item] = _.map(points, function(pair) {
                return pair[1][i];
            });
            return res;
        }, {});
        var paths = _.map(rtop, function(item, i) {
            var itemPoints = _.map(points, function(pair) {
                return pair[1][i];
            });
            return[item, itemPoints];
        });

        var colors = {}
        // console.log('----- Areas!');
        var areas = _.map(paths, function(pair, i) {
            var item = pair[0], path = pair[1];
            colors[item] = Colors2[i];
            // console.log("Building path for", item, path);
            // console.log('Area', i);
            return (
                <StackedArea key={'area-'+ i}
                    item={item}
                    d={roundPathCorners(this.buildPathD(path), 5)}
                    color={colors[item]} />
            );
        }.bind(this));
        areas = areas.reverse();
        for (var i = areas.length; i < this.numElements; i++) {
            // console.log('Area (empty)', i);
            var d = 'M0,'+ this.height +' L'+ maxWidth +','+ maxHeight +'Z';
            areas.push(
                <StackedArea key={'area-'+ i}
                    item={''}
                    d={d}
                    color="rgba(0, 0, 0, 0)" />
            );
        };

        return (
            <div className="sachart-container">
                <div className="filters">
                    <Selector thing="item"
                        items={this.props.items}
                        value={this.state.item}
                        onChange={this.handleFilter.bind(this, 'item')} />
                    <Selector thing="sort"
                        items={['commits']}
                        value={'commits'} />
                </div>
                <svg ref="svg" className="sachart" key="sachart-svg"
                    width="100%" height={maxHeight}
                    viewBox={"0 0 "+ this.state.canvasWidth + " "+ maxHeight}>
                    {areas}
                </svg>
                <ul className="legend">
                    {_.pairs(colors).map(function(pair){
                        return (
                            <li key={'legend-'+ pair[0]}>
                                <div className="color-dot" style={{backgroundColor: pair[1]}}></div>
                                {pair[0]}
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    }
});

var StackedArea = React.createClass({
    mixins: [Chart],
    easing: '0.55, 0.055, 0.675, 0.19',

    getInitialState: function() {
        return {lastd: ''};
    },

    componentDidMount: function() {
        // console.log("-- mounted area");
    },

    componentWillReceiveProps: function(newProps) {
        // console.log("New area props!", newProps.item);
        this.setState({
            lastd: this.props.d,
        }, this.state.lastd === '' ? null : this.animateAll);
    },

    animateAll: function() {
        // console.log("Animating area", this.props.item);
        this.animate(this.refs.path, 'd', this.state.lastd, this.props.d);
    },

    render: function() {
        return (
            <path ref="path"
                d={this.props.d}
                fill={this.props.color}
                shapeRendering="optimizeQuality" />
        );
    }
});
