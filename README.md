# ansible-wordpress

Provision and deploy a **two-server WordPress environment on DigitalOcean**
from a single Ansible command — built from nothing, torn down, and rebuilt on
demand with no one manually touching a server. Full Sail University Project &
Portfolio VI (term 2608); the groundwork the later
[ansible-stig-hardening](https://github.com/data-driven-dynamics-1987/ansible-stig-hardening)
project builds on.

The only manual step in the whole cycle is typing the vault password that
decrypts the DigitalOcean API token.

## What the automation does

- **Provisions the infrastructure** — Ansible calls the DigitalOcean v2 REST
  API to create two droplets and upload the SSH key. Each is 1 vCPU / 1 GB RAM
  / 25 GB disk in NYC1. No droplet is ever created by hand.
- **Installs the LAMP stack** — Apache, MariaDB, and PHP with the modules
  WordPress needs, configured on both servers in parallel over SSH.
- **Deploys WordPress** — cloned straight from the official GitHub repo (a live
  repository, not a copied archive); `wp-config.php` is derived from the cloned
  sample and edited in place on each host.
- **Secures and serves** — ufw allows only ports 22 and 80, a dedicated
  database and user are created, unique salts are fetched from the WordPress
  API, and an Apache virtual host serves the site on each droplet.

## Architecture

```
┌────────────────────────────┐      DigitalOcean v2 REST API (provision)
│  Control node              │─────────────────────────────┐
│  Ubuntu 22.04 (Multipass)  │                              │
│  Ansible 9.x / core 2.16   │                   ┌──────────▼──────────┐
└────────────────────────────┘      SSH (do_wp)  │  TullC-2608-WP1     │
             │                    ┌───────────────│  Ubuntu 22.04       │
             │                    │               │  LAMP + WordPress   │
             └────────────────────┤               └─────────────────────┘
                                  │               ┌─────────────────────┐
                                  └───────────────│  TullC-2608-WP2     │
                                                  │  Ubuntu 22.04       │
                                                  │  LAMP + WordPress   │
                                                  └─────────────────────┘
```

- **Control node:** Ubuntu 22.04 VM via Multipass, Ansible installed from PyPI
  (9.x series / ansible-core 2.16 — **not** the apt package, see below).
- **Targets:** two independent DigitalOcean droplets, each a standalone
  WordPress install with its own database.
- **Trust:** a 4096-bit RSA key (`do_wp`) generated on the control node; the
  public half is uploaded by Ansible and injected at droplet creation.

## Repository layout

```
ansible-wordpress/
├── README.md
├── .gitignore
├── generate_report.js        # renders the full project report to HTML
├── playbooks/
│   ├── provision.yml          # creates droplets, uploads key, builds inventory
│   ├── deploy.yml             # LAMP + WordPress build on both hosts
│   ├── destroy.yml            # removes the two project droplets by name
│   ├── site.yml               # provision + deploy in one command
│   └── ansible.cfg
└── docs/
    ├── report.html            # generated report (run generate_report.js)
    └── images/                # topology diagram, console screenshots
```

## The playbooks

| Playbook | Target | What it does |
|----------|--------|--------------|
| `provision.yml` | `localhost` | REST calls to DigitalOcean — uploads the SSH key, creates both droplets (`unique_name: true` for idempotency), writes `inventory.ini`, and registers hosts in-memory with `add_host` so `site.yml` can deploy in the same run. |
| `deploy.yml` | `wordpress` | Installs the LAMP stack, sets ufw rules **before** enabling the firewall, creates the DB and user over the Unix socket, clones WordPress, edits `wp-config.php` in place, inserts unique salts, and configures the Apache vhost. |
| `destroy.yml` | `localhost` | Deletes the two droplets **by explicit name only** (shared class account — never enumerate all droplets) and removes the stale inventory. |
| `site.yml` | — | `import_playbook` chains provision then deploy into one command. |

## Usage

Everything runs from inside the Multipass control node, from the project
directory, with the vault password supplied at run time.

```bash
# full build in one command
ansible-playbook site.yml --ask-vault-pass

# tear down (removes both project droplets)
ansible-playbook destroy.yml --ask-vault-pass

# rehearse the full cycle and time the rebuild
ansible-playbook destroy.yml --ask-vault-pass
time ansible-playbook site.yml --ask-vault-pass
```

Fresh build runtime is roughly 7–12 minutes end to end; most of it is waiting
for droplets to boot and for apt to install packages.

## Two ordering constraints that matter

1. **Firewall rules precede firewall activation.** The allow rule for port 22
   is applied before `ufw` is enabled — reverse it and the default-deny policy
   severs Ansible's own SSH session mid-play.
2. **Git `safe.directory` precedes the clone.** On a re-run the web root is
   owned by `www-data`, and Git (running as root) refuses a repo owned by
   another user. Registering the path as safe right before the clone is what
   makes the playbook genuinely re-runnable.

## Why Ansible from pip, not apt

The spec called for Ansible 2.9, but Ubuntu 22.04's apt package (2.10.8)
predates the current collection metadata format and throws
`unhashable type: 'dict'` when parsing the `community.digitalocean` module
index — the very modules the assignment links to. Ansible is installed from
PyPI instead, pinned to the 9.x series (ansible-core 2.16), which runs on
Ubuntu 22.04's Python 3.10 and supports the collection format the project
needs.

## The report

`generate_report.js` contains the complete project report — scope of work, the
eight build phases, verification matrix, lessons learned, and the errors
appendix — and renders it to a single self-contained `docs/report.html`:

```bash
node generate_report.js                 # writes docs/report.html
node generate_report.js out.html        # custom output path
```

## Notes

Credentials never enter version control — the DigitalOcean token and database
password live in an Ansible Vault (`group_vars/all/vault.yml`, AES256), and the
SSH keys and vault files are excluded by `.gitignore`. Screenshots in
`docs/images/` have sensitive values redacted.

---

Charles Tull · B.S. Information Technology, Full Sail University
