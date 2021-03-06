package db

import (
	"time"
)

type Repo struct {
	ID          int       `json:"id"`
	OrgID       int       `json:"org_id" db:"org_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	IsPrivate   bool      `json:"is_private" db:"is_private"`
	IsFork      bool      `json:"is_fork" db:"is_fork"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

func (r *Repo) Save() {
	defer measure(time.Now(), "SaveRepo")
	mustExecN(`
		insert into repos (id, org_id, name, description, is_private, is_fork, updated_at)
		values (:id, :org_id, :name, :description, :is_private, :is_fork, now())
		on duplicate key update
			org_id = values(org_id),
			name = values(name),
			description = values(description),
			is_private = values(is_private),
			is_fork = values(is_fork),
			updated_at = now()
	`, r)
}

func OrgRepos(login string) (repos []*Repo) {
	defer measure(time.Now(), "OrgRepos")
	mustSelect(&repos, `
		select *
		from repos r
		left join orgs o on r.org_id = o.id
		where o.login = ?
	`, login)
	return
}
