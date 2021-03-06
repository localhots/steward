package db

import (
	"fmt"
	"time"
)

type (
	StatItem struct {
		Item    string `json:"item"`
		Commits int    `json:"commits"`
		Delta   int    `json:"delta"`
	}
	StatPoint struct {
		StatItem
		Week uint64 `json:"week"`
	}
)

func StatOrgTop(login string, p map[string]interface{}) (res []StatItem) {
	defer measure(time.Now(), "StatOrgTop")
	mustSelectN(&res, fmt.Sprintf(`
        select
            %s as item,
            sum(c.commits) as commits,
            sum(c.additions) - sum(c.deletions) as delta
        from contribs c
        join orgs o
            on o.id = c.org_id
        `+joinContribFT(p["item"])+`
        where
            o.login = :org and
            c.repo_id in `+reposScope(login)+` and
            c.week >= :from and
            c.week <= :to
        group by item
        order by commits desc
    `, p["item"]), p)
	return
}

func StatOrgActivity(login string, p map[string]interface{}) (res []StatPoint) {
	defer measure(time.Now(), "StatOrgActivity")
	mustSelectN(&res, fmt.Sprintf(`
        select
            %s as item,
            sum(c.commits) as commits,
            sum(c.additions) - sum(c.deletions) as delta,
            c.week as week
        from contribs c
        join orgs o on
            o.id = c.org_id
        `+joinContribFT(p["item"])+`
        where
            o.login = :org and
            c.repo_id in `+reposScope(login)+` and
            c.week >= :from and
            c.week <= :to
        group by item, week
        order by week, commits desc
    `, p["item"]), p)
	return
}

func StatTeamTop(login string, p map[string]interface{}) (res []StatItem) {
	defer measure(time.Now(), "StatTeamTop")
	mustSelectN(&res, fmt.Sprintf(`
        select
            %s as item,
            sum(c.commits) as commits,
            sum(c.additions) - sum(c.deletions) as delta
        from contribs c
        join orgs o on
            o.id = c.org_id
        join team_members tm on
            c.user_id = tm.user_id and
            c.org_id = tm.org_id
        join teams t on
            t.id = tm.team_id
        `+joinContribFT(p["item"])+`
        where
            o.login = :org and
            c.repo_id in `+reposScope(login)+` and
            t.name = :team and
            c.week >= :from and
            c.week <= :to
        group by item
        order by commits desc
    `, p["item"]), p)
	return
}

func StatTeamActivity(login string, p map[string]interface{}) (res []StatPoint) {
	defer measure(time.Now(), "StatTeamActivity")
	mustSelectN(&res, fmt.Sprintf(`
        select
            %s as item,
            sum(c.commits) as commits,
            sum(c.additions) - sum(c.deletions) as delta,
            c.week as week
        from contribs c
        join orgs o on
            o.id = c.org_id
        join team_members tm on
            c.user_id = tm.user_id and
            c.org_id = tm.org_id
        join teams t on
            tm.team_id = t.id
        `+joinContribFT(p["item"])+`
        where
            o.login = :org and
            c.repo_id in `+reposScope(login)+` and
            t.name = :team and
            c.week >= :from and
            c.week <= :to
        group by item, week
        order by week, commits desc
    `, p["item"]), p)
	return
}

func StatUserTop(login string, p map[string]interface{}) (res []StatItem) {
	defer measure(time.Now(), "StatUserTop")
	mustSelectN(&res, `
        select
            r.name as item,
            sum(c.commits) as commits,
            sum(c.additions) - sum(c.deletions) as delta
        from contribs c
        join orgs o on
            o.id = c.org_id
        join users u on
            c.user_id = u.id
        join repos r on
            c.repo_id = r.id
        where
            o.login = :org and
            c.repo_id in `+reposScope(login)+` and
            u.login = :user and
            c.week >= :from and
            c.week <= :to
        group by item
        order by commits desc
    `, p)
	return
}

func StatUserActivity(login string, p map[string]interface{}) (res []StatPoint) {
	defer measure(time.Now(), "StatUserActivity")
	mustSelectN(&res, `
        select
            c.week as week,
            r.name as item,
            sum(c.commits) as commits,
            sum(c.additions) - sum(c.deletions) as delta
        from contribs c
        join orgs o on
            o.id = c.org_id
        join users u on
            c.user_id = u.id
        join repos r on
            c.repo_id = r.id
        where
            o.login = :org and
            c.repo_id in `+reposScope(login)+` and
            u.login = :user and
            c.week >= :from and
            c.week <= :to
        group by item
        order by week, commits desc
    `, p)
	return
}

func StatRepoTop(login string, p map[string]interface{}) (res []StatItem) {
	defer measure(time.Now(), "StatRepoTop")
	mustSelectN(&res, fmt.Sprintf(`
        select
            %s as item,
            sum(c.commits) as commits,
            sum(c.additions) - sum(c.deletions) as delta
        from contribs c
        join orgs o on
            o.id = c.org_id
        join repos r on
            c.repo_id = r.id
        `+joinContribFT(p["item"])+`
        where
            o.login = :org and
            c.repo_id in `+reposScope(login)+` and
            r.name = :repo and
            c.week >= :from and
            c.week <= :to
        group by item
        order by commits desc
    `, p["item"]), p)
	return
}

func StatRepoActivity(login string, p map[string]interface{}) (res []StatPoint) {
	defer measure(time.Now(), "StatRepoActivity")
	mustSelectN(&res, fmt.Sprintf(`
        select
            c.week as week,
            %s as item,
            sum(c.commits) as commits,
            sum(c.additions) - sum(c.deletions) as delta
        from contribs c
        join orgs o on
            o.id = c.org_id
        join repos r on
            c.repo_id = r.id
        `+joinContribFT(p["item"])+`
        where
            o.login = :org and
            c.repo_id in `+reposScope(login)+` and
            r.name = :repo and
            c.week >= :from and
            c.week <= :to
        group by week, item
        order by commits desc
    `, p["item"]), p)
	return
}

func joinContribFT(item interface{}) string {
	switch item {
	case "r.name":
		return "join repos r on c.repo_id = r.id"
	case "u.login":
		return "join users u on c.user_id = u.id"
	case "t.name":
		return `
            join team_members tm on
                tm.user_id = c.user_id and
                tm.org_id = c.org_id
            join teams t on
                t.id = tm.team_id`
	default:
		panic("unreachable")
	}
}

func reposScope(login string) string {
	return fmt.Sprintf(`(
        select
            distinct(repo_id)
        from team_repos tr
        join team_members tm on
            tm.team_id = tr.team_id
        join users u on
            u.login = %q
    )`, login)
}
