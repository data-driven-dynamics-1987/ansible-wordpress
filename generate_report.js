#!/usr/bin/env node
/*
 * generate_report.js — WordPress LAMP automation project report
 * Project: ansible-wordpress (Full Sail P&P6, term 2608)
 * Author:  Charles Tull
 *
 * Holds the complete project report (Scope of Work, the eight build phases,
 * verification matrix, lessons learned, and the errors appendix) as structured
 * data and renders it to a single self-contained HTML file.
 *
 * Usage:
 *   node generate_report.js                 # writes docs/report.html
 *   node generate_report.js out.html        # custom output path
 *
 * No dependencies — plain Node.js (fs only).
 */

'use strict';

const fs = require('fs');
const path = require('path');

/* ------------------------------------------------------------------ *
 * The report. One entry per block. Types:
 *   title | h1 | h2 | h3   headings
 *   p                      paragraph
 *   note                   callout (security / ordering / safety notes)
 *   code                   preformatted block (commands, YAML)
 *   ul                     bullet list  { items: [...] }
 *   table                  { head: [...], rows: [[...], ...] }
 * ------------------------------------------------------------------ */
const report = [
  { t: 'title', text: 'Scope of Work' },

  { t: 'h1', text: 'Project Scope Overview' },
  { t: 'p', text: `This month's project automates the full provisioning and deployment of a two-server WordPress environment on DigitalOcean using Ansible. The goal is an environment that can be built from nothing, and torn down and rebuilt on demand, without anyone manually touching a server — the entire process runs from a single command.` },
  { t: 'p', text: `The automation handles:` },
  { t: 'ul', items: [
    `<strong>Provisioning the infrastructure</strong> — Ansible makes RESTful API calls to DigitalOcean to create two droplets and upload the SSH key. Each droplet runs 1 CPU, 1 GB of memory, and a 25 GB disk in the NYC1 region, named to the required standard. No droplet is ever created by hand in the console.`,
    `<strong>Installing the LAMP stack</strong> — Once the droplets exist, Ansible connects to both over SSH and installs Apache, MariaDB, and PHP with the modules WordPress needs, configuring both servers in parallel.`,
    `<strong>Deploying WordPress</strong> — WordPress is cloned directly from its official GitHub repository, keeping it a live repository rather than a copied archive. The configuration file is derived from the cloned sample and edited in place on each server, so a pre-built config is never shipped.`,
    `<strong>Securing and serving the site</strong> — Firewall rules allow only ports 22 and 80, a dedicated database and user are created, and an Apache virtual host is configured so the site is served correctly on each host.`,
  ] },
  { t: 'p', text: `The build runs from an Ubuntu 22.04 control node and targets two independent WordPress instances. The whole environment can be destroyed and rebuilt from one command, with the only manual step being the vault password that decrypts the API token.` },

  { t: 'h1', text: 'Network Topology Diagram with IP Addresses' },
  { t: 'note', text: `Topology diagram lives in <code>docs/images/</code>. Droplet public IPs are assigned by DigitalOcean at provision time and written into <code>inventory.ini</code> by the provisioning playbook.` },

  { t: 'h1', text: 'Cloud Automation Procedural Instructions' },

  /* ---------------- Phase 1 ---------------- */
  { t: 'h1', text: 'Phase 1 — Build the Ansible Control Node' },
  { t: 'p', text: `The project specification requires the control node to run CentOS Stream 9, Ubuntu 20.04 or later, or Rocky Linux 8 or 9. macOS does not satisfy this requirement, so a Linux virtual machine must be created first. Multipass was chosen because it produces a genuine Ubuntu VM from a single command with no installer to step through.` },
  { t: 'h3', text: 'Step 1.1 — Install Multipass on the workstation' },
  { t: 'p', text: `Open Terminal on the macOS workstation. If Homebrew is not present, install it first:` },
  { t: 'code', text: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` },
  { t: 'p', text: `Then install Multipass:` },
  { t: 'code', text: `brew install --cask multipass` },
  { t: 'h3', text: 'Step 1.2 — Launch the control node' },
  { t: 'code', text: `multipass launch 22.04 --name ansible-vm --memory 2G --disk 20G --cpus 2` },
  { t: 'p', text: `The image download takes two to five minutes on first run. Subsequent launches are near-instant.` },
  { t: 'h3', text: 'Step 1.3 — Enter the virtual machine' },
  { t: 'code', text: `multipass shell ansible-vm` },
  { t: 'p', text: `The shell prompt must now read <code>ubuntu@ansible-vm:~$</code>. Every remaining command in this document is executed inside this virtual machine. If the prompt shows the workstation hostname instead, the commands are being run in the wrong place.` },
  { t: 'h3', text: 'Checkpoint 1' },
  { t: 'code', text: `lsb_release -a` },
  { t: 'p', text: `Expected result: the release description reports Ubuntu 22.04 LTS. Do not proceed until this is confirmed.` },
  { t: 'note', text: `The virtual machine persists across workstation reboots. To resume work later, run <code>multipass start ansible-vm</code> followed by <code>multipass shell ansible-vm</code> from the workstation terminal.` },

  /* ---------------- Phase 2 ---------------- */
  { t: 'h1', text: 'Phase 2 — Install Ansible and Required Collections' },
  { t: 'h3', text: 'Step 2.1 — Update the base system' },
  { t: 'code', text: `sudo apt update
sudo apt upgrade -y
sudo apt install -y python3-pip git curl` },
  { t: 'h3', text: 'Step 2.2 — Install Ansible via pip, not apt' },
  { t: 'p', text: `This step deviates deliberately from the obvious approach and the reason matters. The Ubuntu 22.04 apt repository ships Ansible 2.10.8, which predates the current collection metadata format. Installing the DigitalOcean collection against that version produces the error <code>unhashable type: 'dict'</code> whenever the module index is parsed, which makes the collection unusable. Ansible is therefore installed from PyPI instead.` },
  { t: 'code', text: `pip3 install --user "ansible>=9.0,<10.0"
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc` },
  { t: 'p', text: `The version is pinned to the 9.x series on purpose. Ansible 10 and later require Python 3.11, while Ubuntu 22.04 ships Python 3.10. The 9.x series bundles ansible-core 2.16, which runs correctly on Python 3.10 and fully supports the collection format used by the <code>community.digitalocean</code> modules referenced in the project specification.` },
  { t: 'h3', text: 'Step 2.3 — Install the required collections' },
  { t: 'code', text: `ansible-galaxy collection install community.digitalocean
ansible-galaxy collection install community.mysql
ansible-galaxy collection install community.general
pip3 install --user requests` },
  { t: 'h3', text: 'Checkpoint 2' },
  { t: 'code', text: `which ansible
ansible --version
ansible-doc -l | grep digital_ocean_droplet` },
  { t: 'p', text: `Expected result: the binary path resolves to <code>/home/ubuntu/.local/bin/ansible</code>, the reported core version is 2.16.x, and the final command returns a single line describing the droplet module. A version of 2.10.8 indicates the apt package is still first on the PATH; run <code>hash -r</code> and re-check.` },

  /* ---------------- Phase 3 ---------------- */
  { t: 'h1', text: 'Phase 3 — SSH Key Pair and DigitalOcean API Token' },
  { t: 'h2', text: '3.1 Generate the SSH key pair' },
  { t: 'p', text: `This key pair establishes the SSH trust relationship required by the specification. The private key never leaves the control node; the public key is uploaded to DigitalOcean by Ansible and injected into each droplet at creation time.` },
  { t: 'code', text: `ssh-keygen -t rsa -b 4096 -f ~/.ssh/do_wp -N ""
cat ~/.ssh/do_wp.pub` },
  { t: 'p', text: `Expected result: a single line beginning with <code>ssh-rsa</code>. This is the value the provisioning playbook reads and uploads to DigitalOcean.` },
  { t: 'table', head: ['Flag', 'Meaning'], rows: [
    ['-t rsa -b 4096', 'Generate a 4096-bit RSA key pair.'],
    ['-f ~/.ssh/do_wp', 'Write the private key to ~/.ssh/do_wp and the public key to ~/.ssh/do_wp.pub.'],
    ['-N ""', 'Set an empty passphrase so Ansible can authenticate without operator interaction.'],
  ] },
  { t: 'h2', text: '3.2 Generate the DigitalOcean API token' },
  { t: 'p', text: `This is the only step in the entire build that uses the DigitalOcean web interface.` },
  { t: 'ul', items: [
    `In the DigitalOcean control panel, expand ACCOUNT in the left navigation and select API.`,
    `Select the Tokens tab, then click Generate New Token.`,
    `Enter a descriptive name, select the longest available expiration, and set the scope to Full Access. A read-only token cannot create droplets.`,
    `Copy the token immediately. It is displayed exactly once and cannot be retrieved afterwards.`,
  ] },
  { t: 'note', text: `<strong>Security note.</strong> Suppress shell history for any command containing the token by enabling <code>ignorespace</code> and prefixing the command with a single space:` },
  { t: 'code', text: `echo 'export HISTCONTROL=ignorespace' >> ~/.bashrc
source ~/.bashrc` },
  { t: 'h2', text: '3.3 Validate the token before writing any playbooks' },
  { t: 'p', text: `Validating the credential independently avoids the common failure mode of debugging Ansible and an invalid token at the same time. Note the leading space, which keeps the token out of shell history.` },
  { t: 'code', text: ` curl -X GET \\
   -H "Authorization: Bearer <YOUR_TOKEN>" \\
   "https://api.digitalocean.com/v2/account"` },
  { t: 'h3', text: 'Checkpoint 3' },
  { t: 'p', text: `Expected result: a JSON document containing the account email address, droplet limit, and status. A response of <code>{"id": "unauthorized"}</code> means the token is mistyped, expired, or read-only. On a shared team account, it may also mean the member role lacks token-generation rights, which requires escalation to the account owner.` },

  /* ---------------- Phase 4 ---------------- */
  { t: 'h1', text: 'Phase 4 — Project Structure and Credential Encryption' },
  { t: 'h3', text: 'Step 4.1 — Create the project directory' },
  { t: 'code', text: `mkdir -p ~/wordpress-project/group_vars/all
cd ~/wordpress-project` },
  { t: 'p', text: `All remaining work is performed from this directory. The final structure is:` },
  { t: 'code', text: `wordpress-project/
├── ansible.cfg
├── provision.yml
├── deploy.yml
├── destroy.yml
├── site.yml
├── inventory.ini          (generated at run time)
└── group_vars/
    └── all/
        └── vault.yml      (encrypted)` },
  { t: 'h3', text: 'Step 4.2 — Create the Ansible configuration file' },
  { t: 'code', text: `nano ansible.cfg

[defaults]
host_key_checking = False
inventory = ./inventory.ini
interpreter_python = auto_silent
retry_files_enabled = False` },
  { t: 'p', text: `Disabling host key checking is required rather than merely convenient. Newly created droplets present host fingerprints the control node has never seen; without this setting, every connection would block on an interactive confirmation prompt and the automation would stall. Save the file with Ctrl+O, Enter, then exit with Ctrl+X.` },
  { t: 'h3', text: 'Step 4.3 — Set the default editor' },
  { t: 'p', text: `Ansible Vault opens the system default editor, which on a minimal Ubuntu image is vim. Setting nano avoids an unnecessary detour.` },
  { t: 'code', text: `echo 'export EDITOR=nano' >> ~/.bashrc
source ~/.bashrc` },
  { t: 'h3', text: 'Step 4.4 — Create the encrypted vault' },
  { t: 'code', text: `ansible-vault create group_vars/all/vault.yml` },
  { t: 'p', text: `A vault password is requested twice. This password is required on every playbook run and cannot be recovered if lost. The editor then opens; enter the following two variables, substituting the real token:` },
  { t: 'code', text: `vault_do_token: dop_v1_<your_real_token>
vault_wp_db_pass: <a strong database password>` },
  { t: 'h3', text: 'Checkpoint 4' },
  { t: 'code', text: `cat group_vars/all/vault.yml` },
  { t: 'p', text: `Expected result: the file begins with <code>$ANSIBLE_VAULT;1.1;AES256</code> followed by hexadecimal ciphertext. Plaintext at this point means encryption did not occur. To inspect or amend the contents later, use <code>ansible-vault view</code> or <code>ansible-vault edit</code> — never <code>cat</code>.` },

  /* ---------------- Phase 5 ---------------- */
  { t: 'h1', text: 'Phase 5 — Provisioning Playbook' },
  { t: 'p', text: `This playbook performs all DigitalOcean infrastructure operations. It runs entirely against localhost because the DigitalOcean modules issue REST calls outbound rather than connecting to a managed host.` },
  { t: 'h3', text: 'Step 5.1 — Create provision.yml' },
  { t: 'code', text: `---
# provision.yml - Charles Tull, PP6 Module 1
# Creates two DigitalOcean droplets via the v2 REST API, uploads the control
# node's public key, and hands the assigned addresses to deploy.yml.
# Requires vault_do_token in group_vars/all/vault.yml.
# Run: ansible-playbook provision.yml --ask-vault-pass
- name: Provision DigitalOcean droplets for WordPress
  hosts: localhost
  connection: local
  gather_facts: false
  vars:
    droplet_names:
      - TullC-2608-WP1
      - TullC-2608-WP2
    do_region: nyc1
    do_size: s-1vcpu-1gb
    do_image: ubuntu-22-04-x64
  tasks:
    - name: Upload SSH public key to DigitalOcean
      community.digitalocean.digital_ocean_sshkey:
        name: Charles-Tull-2608
        ssh_pub_key: "{{ lookup('file', '~/.ssh/do_wp.pub') }}"
        oauth_token: "{{ vault_do_token }}"
        state: present
      register: ssh_key_result

    - name: Show the key fingerprint
      debug:
        msg: "SSH key fingerprint: {{ ssh_key_result.data.ssh_key.fingerprint }}"

    - name: Create the two droplets
      community.digitalocean.digital_ocean_droplet:
        name: "{{ item }}"
        oauth_token: "{{ vault_do_token }}"
        state: present
        # Idempotency. Without this, a second run creates two MORE droplets
        # instead of recognizing the existing ones by name.
        unique_name: true
        size: "{{ do_size }}"
        region: "{{ do_region }}"
        image: "{{ do_image }}"
        ssh_keys:
          - "{{ ssh_key_result.data.ssh_key.fingerprint }}"
        wait: true
        wait_timeout: 600
      loop: "{{ droplet_names }}"
      register: droplet_result

    - name: Write the inventory file
      copy:
        dest: ./inventory.ini
        content: |
          [wordpress]
          {% for d in droplet_result.results %}
          {{ d.data.droplet.networks.v4 | selectattr('type','equalto','public')
             | map(attribute='ip_address') | first }}
          {% endfor %}
          [wordpress:vars]
          ansible_user=root
          ansible_ssh_private_key_file=~/.ssh/do_wp
          ansible_ssh_common_args='-o StrictHostKeyChecking=no'

    # Ansible parses the inventory file once, at startup. The file written by
    # the task above is therefore invisible to the deploy play during a
    # site.yml run. add_host registers the hosts in the running inventory.
    - name: Add droplets to in-memory inventory
      add_host:
        name: "{{ d.data.droplet.networks.v4 | selectattr('type','equalto','public')
                  | map(attribute='ip_address') | first }}"
        groups: wordpress
        ansible_user: root
        ansible_ssh_private_key_file: ~/.ssh/do_wp
        ansible_ssh_common_args: '-o StrictHostKeyChecking=no'
      loop: "{{ droplet_result.results }}"
      loop_control:
        loop_var: d

    - name: Wait for SSH to become available
      wait_for:
        host: "{{ d.data.droplet.networks.v4 | selectattr('type','equalto','public')
                  | map(attribute='ip_address') | first }}"
        port: 22
        delay: 20
        timeout: 400
      loop: "{{ droplet_result.results }}"
      loop_control:
        loop_var: d

    - name: Show the droplet IPs
      debug:
        msg: "{{ d.data.droplet.name }} is at
              {{ d.data.droplet.networks.v4 | selectattr('type','equalto','public')
                 | map(attribute='ip_address') | first }}"
      loop: "{{ droplet_result.results }}"
      loop_control:
        loop_var: d` },
  { t: 'p', text: `Confirm the file parses before running it:` },
  { t: 'code', text: `ansible-playbook provision.yml --syntax-check --ask-vault-pass` },
  { t: 'h3', text: 'Step 5.2 — Key implementation details' },
  { t: 'table', head: ['Element', 'Rationale'], rows: [
    ['unique_name: true', 'Makes droplet creation idempotent. Without it, a second run of the playbook would create two additional droplets rather than recognising the existing ones. This is what allows the same playbook to be run repeatedly during development and again during the live demonstration.'],
    ['ssh_keys with the registered fingerprint', 'The fingerprint returned by the sshkey upload task is passed directly into droplet creation, so the public key is present in the root account at first boot. This establishes SSH trust without any manual key distribution step.'],
    ['size: s-1vcpu-1gb', 'Resolves to 1 vCPU, 1 GB RAM, and a 25 GB disk — at or below every ceiling in the specification.'],
    ['copy writing inventory.ini', 'Persists the assigned public IP addresses to disk so the deployment playbook can be executed independently during troubleshooting.'],
    ['add_host registering the same IPs', 'Ansible parses the inventory file once, at start-up. A file written mid-run is invisible to a later play in the same execution. The add_host module injects the hosts into the running inventory, which is what allows site.yml to provision and deploy in a single command.'],
    ['wait_for on port 22', 'The DigitalOcean API reports a droplet as active before the SSH daemon is accepting connections. Without this gate the deployment play fails with unreachable-host errors on a cold build.'],
  ] },
  { t: 'h3', text: 'Step 5.3 — Execute' },
  { t: 'code', text: `ansible-playbook provision.yml --ask-vault-pass` },
  { t: 'p', text: `Runtime is two to four minutes, most of which is spent waiting for the droplets to finish booting.` },
  { t: 'h3', text: 'Checkpoint 5' },
  { t: 'p', text: `Three independent verifications are required before proceeding.` },
  { t: 'ul', items: [
    `The play recap reports failed=0 and both droplets are created under their required names.`,
    `The inventory file contains two addresses under a [wordpress] group.`,
    `SSH trust is functional to both hosts.`,
  ] },
  { t: 'p', text: `Confirm in the DigitalOcean console that both droplets exist, are active, and carry the required names. This view also evidences compliance with the size ceiling, since each entry reports 1 GB RAM and a 25 GB disk. Finally, confirm the control node can reach both managed hosts over SSH:` },
  { t: 'code', text: `cat inventory.ini
ansible -i inventory.ini wordpress -m ping --ask-vault-pass` },
  { t: 'p', text: `The ping module must return SUCCESS with <code>"ping": "pong"</code> for both addresses. An interactive login with <code>ssh -i ~/.ssh/do_wp root@&lt;droplet_ip&gt;</code> gives the same confirmation and is worth performing once, because it demonstrates that the key injected at creation time is the key held by the control node — no password is requested at any point. Do not continue to Phase 6 until this passes, because every subsequent task depends on that SSH channel.` },

  /* ---------------- Phase 6 ---------------- */
  { t: 'h1', text: 'Phase 6 — Deployment Playbook' },
  { t: 'p', text: `This playbook targets the two droplets and performs the complete WordPress build. It is the section that satisfies requirement 2 of the specification: package installation, firewall rules, database configuration, Git clone, and in-place modification of the cloned configuration.` },
  { t: 'p', text: `At this point the droplets exist and accept SSH, but nothing is listening on port 80. Browsing to either address returns ERR_CONNECTION_REFUSED, which is the expected state between provisioning and deployment.` },
  { t: 'h3', text: 'Step 6.1 — Create deploy.yml' },
  { t: 'p', text: `Enter the following file in full. It is long; verify that the final handler block is present before saving. (The complete, corrected version is reproduced in the <em>Final Script</em> section below.)` },
  { t: 'h3', text: 'Step 6.2 — Task groups and their purpose' },
  { t: 'table', head: ['Task group', 'Modules used', 'Purpose'], rows: [
    ['Package installation', 'apt', 'Installs Apache, MariaDB, PHP 8.1 with the extensions WordPress requires, python3-pymysql for the database modules, git, and ufw.'],
    ['Firewall configuration', 'ufw', 'Adds allow rules for TCP 22 and TCP 80, then enables the firewall with a default deny policy. Rule ordering is significant and is discussed below.'],
    ['Database configuration', 'community.mysql.mysql_db, community.mysql.mysql_user', 'Creates the wordpress database and a dedicated wpuser account scoped to that database only. Authentication uses the Unix socket, since MariaDB on Ubuntu 22.04 authenticates the root account by socket rather than password.'],
    ['Source retrieval', 'git', 'Clones the official WordPress repository directly into the web root, leaving a working Git repository in place so upstream updates can be pulled later.'],
    ['Configuration', 'copy, replace, uri, lineinfile, blockinfile', 'Derives wp-config.php from the cloned sample on the target host, substitutes the database credentials, retrieves unique cryptographic salts from the WordPress API, and replaces the placeholder salt definitions.'],
    ['Web server configuration', 'copy, command, apache2_module', 'Writes a virtual host pointing at the WordPress directory, enables it, disables the default site, and enables mod_rewrite for permalink support.'],
  ] },
  { t: 'h3', text: 'Step 6.3 — Two ordering constraints that matter' },
  { t: 'note', text: `<strong>Firewall rules precede firewall activation.</strong> The allow rule for port 22 is applied before ufw is enabled. Reversing this order causes the default deny policy to sever the control node's own SSH session mid-play, leaving the host unreachable and the build half-finished.` },
  { t: 'note', text: `<strong>Git safe.directory precedes the clone.</strong> On a repeat run, the WordPress directory is owned by www-data because of the ownership task at the end of the previous run. Git, executing as root, refuses to operate on a repository owned by another user and aborts with a dubious ownership error. Registering the path as a safe directory immediately before the clone makes the playbook genuinely re-runnable, which is essential since the demonstration is itself a rebuild.` },
  { t: 'h3', text: 'Step 6.4 — Execute' },
  { t: 'code', text: `ansible-playbook -i inventory.ini deploy.yml --ask-vault-pass` },
  { t: 'p', text: `Runtime is five to eight minutes. Both hosts are configured in parallel, so each task reports a result for both addresses before the play advances.` },
  { t: 'h3', text: 'Checkpoint 6' },
  { t: 'p', text: `The play recap must report failed=0 for both hosts. The changed count is worth reading rather than skimming. On a fresh build it lands in the high teens, because nearly every task is doing work for the first time. On a re-run against already-configured hosts it drops to a handful, because the remaining tasks find the system already in its desired state. That difference between runs is the practical evidence that the playbook is idempotent.` },
  { t: 'p', text: `Browse to the public IP address of each droplet over HTTP. The WordPress installation wizard confirms that Apache is serving, PHP is executing, and the database credentials written into the cloned configuration file are valid. Complete the wizard on each host. The resulting site confirms the full stack is operational end to end.` },

  /* ---------------- Phase 7 ---------------- */
  { t: 'h1', text: 'Phase 7 — Teardown and Orchestration' },
  { t: 'p', text: `The specification states that all droplets are removed before the demonstration and the environment must be recreated on demand. Two additional playbooks make that a single-command operation.` },
  { t: 'h3', text: 'Step 7.1 — Create destroy.yml' },
  { t: 'code', text: `---
# destroy.yml - Charles Tull, PP6 Module 1
# Removes the two project droplets and the generated inventory file.
# Run: ansible-playbook destroy.yml --ask-vault-pass
- name: Destroy project droplets
  hosts: localhost
  connection: local
  gather_facts: false
  vars:
    droplet_names:
      - TullC-2608-WP1
      - TullC-2608-WP2
  tasks:
    # Deletes by explicit name only. This is a shared class account - a
    # teardown that looped over every droplet would destroy other students'
    # resources along with mine.
    - name: Delete droplets by name
      community.digitalocean.digital_ocean_droplet:
        name: "{{ item }}"
        oauth_token: "{{ vault_do_token }}"
        state: absent
        unique_name: true
      loop: "{{ droplet_names }}"

    - name: Remove the stale inventory file
      file:
        path: ./inventory.ini
        state: absent` },
  { t: 'note', text: `<strong>Safety note.</strong> This playbook deletes droplets by explicit name only. On a shared team account containing other students' resources, a teardown that enumerates all droplets in the account would be destructive well beyond its intended scope. Never generalize this playbook to operate on an unfiltered droplet list.` },
  { t: 'h3', text: 'Step 7.2 — Create site.yml' },
  { t: 'code', text: `---
# site.yml - Charles Tull, PP6 Module 1
# Full build in one command: provision then deploy.
# Run: ansible-playbook site.yml --ask-vault-pass
- import_playbook: provision.yml
- import_playbook: deploy.yml` },
  { t: 'p', text: `This chains the two playbooks so that provisioning and deployment execute as one operation. It works only because provision.yml registers its hosts with add_host; without that task, the deployment play finds no matching hosts and is skipped with a "no hosts matched" warning.` },
  { t: 'h3', text: 'Step 7.3 — Rehearse the full cycle' },
  { t: 'code', text: `ansible-playbook destroy.yml --ask-vault-pass
time ansible-playbook site.yml --ask-vault-pass` },
  { t: 'p', text: `Run this cycle at least twice before the demonstration. The time prefix records the total rebuild duration, which is a useful figure to quote while the playbook is running during the presentation.` },

  /* ---------------- Phase 8 ---------------- */
  { t: 'h1', text: 'Phase 8 — WordPress Installation and Login Validation' },
  { t: 'p', text: `The deployment playbook leaves each droplet serving the WordPress installation wizard. Completing that wizard and confirming administrative access is the final step, and it is what demonstrates that every layer of the stack — Apache, PHP, the database, and the cloned configuration file — is working together rather than merely installed.` },
  { t: 'h2', text: '8.1 Complete the installation on each host' },
  { t: 'p', text: `Browse to the public address of each droplet. The wizard requests four values:` },
  { t: 'ul', items: [
    `<strong>Site Title</strong> — the droplet name is a convenient choice, since it makes screenshots self-identifying.`,
    `<strong>Username</strong> — the administrative account for this site.`,
    `<strong>Password</strong> — record this; it is required again after any rebuild.`,
    `<strong>Email address</strong> — used for administrative notifications only.`,
  ] },
  { t: 'p', text: `The two droplets are independent installations with separate databases, so the wizard must be completed on each and the credentials are not shared between them. Record both sets before moving on.` },
  { t: 'h2', text: '8.2 Confirm administrative login' },
  { t: 'p', text: `After the wizard completes, log in at the /wp-admin path on each host and confirm the dashboard loads. Reaching the dashboard is the acceptance criterion — the front-end site can render from cached files, but the dashboard cannot load unless the database credentials written into the cloned wp-config.php are valid and the session cookie validates against the configured salts.` },
  { t: 'code', text: `http://<droplet_ip>/wp-admin` },
  { t: 'p', text: `Site Health reporting Good on both hosts is a useful secondary signal: it means WordPress could reach its own REST API, the database responded, and the PHP extension set is complete.` },
  { t: 'h2', text: '8.3 System tests from the control node' },
  { t: 'p', text: `The following ad-hoc commands validate the managed hosts without logging into either of them individually. Each returns a result for both droplets, so a discrepancy between the two is immediately visible.` },
  { t: 'code', text: `# SSH trust and Python interpreter on both hosts
ansible -i inventory.ini wordpress -m ping --ask-vault-pass

# firewall state — expect 22 and 80 allowed, default deny
ansible -i inventory.ini wordpress -a "ufw status" --ask-vault-pass

# web and database services running
ansible -i inventory.ini wordpress -a "systemctl is-active apache2 mariadb" \\
  --ask-vault-pass

# confirm WordPress is a live git clone rather than a copied archive
ansible -i inventory.ini wordpress -a "ls -a /var/www/html/wordpress" \\
  --ask-vault-pass

# confirm the database and application user exist
ansible -i inventory.ini wordpress -a "mysql -e 'SHOW DATABASES;'" \\
  --ask-vault-pass` },
  { t: 'p', text: `The fourth command is worth running deliberately rather than assuming. A .git directory in the listing is the direct evidence that requirement 2 of the specification was satisfied — the WordPress source is a working repository that can pull upstream changes, not a static copy.` },
  { t: 'h2', text: '8.4 Post-rebuild expectation' },
  { t: 'p', text: `After a teardown and rebuild, each site returns to the installation wizard rather than the configured dashboard. This is correct behavior, not a defect: the database lives on the droplet, so destroying the droplet destroys the site content along with it. The playbook restores the infrastructure and the application; the four wizard values are supplied by the operator afterwards.` },
  { t: 'p', text: `If the environment needs to return to a fully installed state with no manual input at all, the WordPress command-line tool can perform the installation as a final playbook task. That was outside the scope of this build, and confirming manual login access is what the specification asks for.` },

  /* ---------------- Verification ---------------- */
  { t: 'h1', text: '9. Verification and Acceptance Testing' },
  { t: 'p', text: `The following tests constitute acceptance for this build. All must pass on a rebuild from an empty account.` },
  { t: 'table', head: ['#', 'Test', 'Command or action', 'Expected result'], rows: [
    ['1', 'Control node ready', 'ansible --version', 'ansible-core 2.16.x reported'],
    ['2', 'Collections present', 'ansible-doc -l | grep digital_ocean_droplet', 'Module description returned'],
    ['3', 'API credential valid', 'curl against /v2/account', 'Account JSON returned'],
    ['4', 'Vault encrypted', 'cat group_vars/all/vault.yml', 'AES256 header and ciphertext'],
    ['5', 'Droplets created', 'DigitalOcean console', 'TullC-2608-WP1 and WP2 active, NYC1, 1 GB RAM, 25 GB disk'],
    ['6', 'Naming compliant', 'DigitalOcean console', 'Names match the required format exactly'],
    ['7', 'SSH trust established', 'ansible -i inventory.ini wordpress -m ping', 'SUCCESS / pong on both hosts'],
    ['8', 'Deployment clean', 'Play recap', 'failed=0 on both hosts'],
    ['9', 'Firewall correct', 'ufw status on either host', 'Ports 22 and 80 allowed, default deny'],
    ['10', 'Git clone genuine', 'ls -a /var/www/html/wordpress', 'A .git directory is present'],
    ['11', 'Config modified in place', 'grep DB_NAME wp-config.php', 'Project database name, not the sample placeholder'],
    ['12', 'WordPress reachable', 'Browse to each droplet IP', 'Installation wizard or completed site loads'],
    ['13', 'Rebuild repeatable', 'destroy.yml then site.yml', 'Full environment restored, failed=0'],
    ['14', 'Admin login works', 'Log in at /wp-admin on each host', 'Dashboard loads on both, Site Health reports Good'],
  ] },

  /* ---------------- Final Script ---------------- */
  { t: 'h1', text: 'Final Script' },
  { t: 'p', text: `The complete, corrected deploy.yml is reproduced below.` },
  { t: 'code', text: `---
# deploy.yml - Charles Tull, PP6 Module 1
# Installs the LAMP stack, configures ufw and MariaDB, clones WordPress from
# GitHub, and edits the cloned wp-config.php in place on both droplets.
# Run: ansible-playbook -i inventory.ini deploy.yml --ask-vault-pass
- name: Deploy LAMP stack and WordPress
  hosts: wordpress
  become: true
  vars:
    wp_db_name: wordpress
    wp_db_user: wpuser
    wp_db_pass: "{{ vault_wp_db_pass }}"
    wp_path: /var/www/html/wordpress
  tasks:
    - name: Update apt cache
      apt:
        update_cache: true

    - name: Install LAMP stack and dependencies
      apt:
        name:
          - apache2
          - mariadb-server
          - php
          - libapache2-mod-php
          - php-mysql
          - php-curl
          - php-gd
          - php-xml
          - php-mbstring
          - php-zip
          - python3-pymysql
          - git
          - ufw
        state: present
        update_cache: true

    # Order matters. Enabling ufw before this rule exists would apply the
    # default deny policy and sever Ansible's own SSH session mid-play.
    - name: Allow SSH through the firewall
      ufw:
        rule: allow
        port: '22'
        proto: tcp

    - name: Allow HTTP through the firewall
      ufw:
        rule: allow
        port: '80'
        proto: tcp

    - name: Enable the firewall
      ufw:
        state: enabled
        policy: deny

    - name: Ensure MariaDB is running
      service:
        name: mariadb
        state: started
        enabled: true

    # MariaDB on Ubuntu 22.04 authenticates root by Unix socket, not by
    # password, so there is no login_password to supply.
    - name: Create the WordPress database
      community.mysql.mysql_db:
        name: "{{ wp_db_name }}"
        state: present
        login_unix_socket: /var/run/mysqld/mysqld.sock

    - name: Create the WordPress database user
      community.mysql.mysql_user:
        name: "{{ wp_db_user }}"
        password: "{{ wp_db_pass }}"
        priv: "{{ wp_db_name }}.*:ALL"
        host: localhost
        state: present
        login_unix_socket: /var/run/mysqld/mysqld.sock

    # On a re-run this directory is owned by www-data (see the ownership task
    # further down), and git running as root refuses to operate on a repo
    # owned by another user. Without this the playbook only works once.
    - name: Mark the WordPress path as a safe git directory
      command: git config --global --add safe.directory {{ wp_path }}
      changed_when: false

    - name: Clone WordPress from GitHub
      git:
        repo: https://github.com/WordPress/WordPress.git
        dest: "{{ wp_path }}"
        version: master
        force: true

    - name: Create wp-config.php from the cloned sample
      copy:
        src: "{{ wp_path }}/wp-config-sample.php"
        dest: "{{ wp_path }}/wp-config.php"
        remote_src: true
        # force: false so a re-run does not overwrite the config we edited.
        force: false

    - name: Set database credentials in wp-config.php
      replace:
        path: "{{ wp_path }}/wp-config.php"
        regexp: "{{ item.find }}"
        replace: "{{ item.replace }}"
      loop:
        - { find: 'database_name_here', replace: "{{ wp_db_name }}" }
        - { find: 'username_here',      replace: "{{ wp_db_user }}" }
        - { find: 'password_here',      replace: "{{ wp_db_pass }}" }

    # Salts are fetched and inserted in a single shell task guarded by a
    # marker file. The old three-task approach (uri + lineinfile + blockinfile)
    # inserted malformed PHP on a fresh clone, which broke every login. This
    # runs once, writes valid define() lines, and never rewrites them on a
    # re-run - so the login works after every rebuild with no manual fix.
    - name: Set unique salts in wp-config.php
      shell: |
        set -e
        sed -i "/^define(\\s*'\\(AUTH\\|SECURE_AUTH\\|LOGGED_IN\\|NONCE\\)_\\(KEY\\|SALT\\)'/d" {{ wp_path }}/wp-config.php
        sed -i "/ANSIBLE MANAGED SALTS/d" {{ wp_path }}/wp-config.php
        curl -s https://api.wordpress.org/secret-key/1.1/salt/ > /tmp/wp_salts.txt
        sed -i "/That's all, stop editing/e cat /tmp/wp_salts.txt" {{ wp_path }}/wp-config.php
      args:
        creates: "{{ wp_path }}/.salts_done"

    - name: Mark salts as generated
      file:
        path: "{{ wp_path }}/.salts_done"
        state: touch
      changed_when: false

    - name: Set file ownership
      file:
        path: "{{ wp_path }}"
        owner: www-data
        group: www-data
        recurse: true

    - name: Configure the Apache virtual host
      copy:
        dest: /etc/apache2/sites-available/wordpress.conf
        content: |
          <VirtualHost *:80>
              DocumentRoot {{ wp_path }}
              <Directory {{ wp_path }}>
                  AllowOverride All
                  Require all granted
              </Directory>
              ErrorLog \${APACHE_LOG_DIR}/wp-error.log
              CustomLog \${APACHE_LOG_DIR}/wp-access.log combined
          </VirtualHost>
      notify: restart apache

    - name: Enable the WordPress site
      command: a2ensite wordpress.conf
      args:
        creates: /etc/apache2/sites-enabled/wordpress.conf
      notify: restart apache

    - name: Disable the default site
      command: a2dissite 000-default.conf
      args:
        removes: /etc/apache2/sites-enabled/000-default.conf
      notify: restart apache

    - name: Enable mod_rewrite
      apache2_module:
        name: rewrite
        state: present
      notify: restart apache

  handlers:
    - name: restart apache
      service:
        name: apache2
        state: restarted` },

  /* ---------------- Lessons Learned ---------------- */
  { t: 'h1', text: 'Lessons Learned' },
  { t: 'p', text: `<strong>Idempotency is the whole point of automation, not a bonus feature.</strong> My deploy playbook worked the first time and broke on the second run, because a task assumed a clean directory that a previous run had already changed. A script that only works once isn't automation; it's a manual process written in YAML. Making it survive repeated runs took more effort than making it work at all, and that effort is where the real learning was.` },
  { t: 'p', text: `<strong>A version requirement can be a trap, not a floor.</strong> The spec asked for Ansible 2.9, so I installed it, and it couldn't parse the DigitalOcean modules the assignment itself links to, because those modules didn't exist in that version. The lesson wasn't "use a newer version," it was to stop trusting a requirement blindly and verify that the pieces fit together before building on them.` },
  { t: 'p', text: `<strong>Document during the work, not after it.</strong> Recording errors and their fixes as they happened produced documentation specific enough for someone else to reproduce the build, which is the real test of whether it's any good. Reconstructing it from memory at the end would have lost exactly the details that make it useful.` },

  /* ---------------- Appendix ---------------- */
  { t: 'h1', text: 'Appendix A — Documented Errors & Solutions' },
  { t: 'h2', text: '1. Issue Encountered and Resolution' },
  { t: 'p', text: `One defect during development is documented here in full, because it is not obvious from the error text, it will recur for any co-developer reproducing this build, and the fix is reflected directly in the deployment playbook.` },
  { t: 'h3', text: '1.1 Symptom' },
  { t: 'p', text: `The first execution of the deployment playbook completed successfully. A subsequent execution against the same hosts failed at the Git clone task on both droplets, with the play recap reporting failed=1 for each.` },
  { t: 'code', text: `TASK [Clone WordPress from GitHub] ******************************
fatal: [159.89.224.130]: FAILED! => {"changed": false, "msg":
  "Failed to set a new url https://github.com/WordPress/WordPress.git
   for origin: fatal: detected dubious ownership in repository at
   '/var/www/html/wordpress'"}` },
  { t: 'h3', text: '1.2 Root cause' },
  { t: 'p', text: `The failure is a consequence of the playbook's own final task rather than anything in the Git configuration. On the first run the web root did not exist, so Git created the repository while running as root and the repository was owned by root. The last task in the play then recursively changed ownership of the WordPress directory to www-data, which Apache needs to serve and write to the site.` },
  { t: 'p', text: `On the second run Git — still executing as root — encountered a repository owned by a different user. Since version 2.35.2, Git treats this as a potential privilege-escalation vector and refuses to operate on the repository at all. The behavior is therefore correct and intentional on Git's part; the defect is in the playbook, which was only ever exercised against a clean host.` },
  { t: 'p', text: `This mattered more than an ordinary bug, because the project is assessed by destroying the environment and rebuilding it on demand. A playbook that succeeds once and fails on every subsequent run is not automation, and the failure would have surfaced during the live demonstration rather than during development.` },
  { t: 'h3', text: '1.3 Resolution' },
  { t: 'p', text: `A task was added immediately before the clone that registers the web root as a trusted path for Git. changed_when: false is set because the task is a configuration assertion rather than a state change, and reporting it as changed on every run would obscure the genuine change count in the play recap.` },
  { t: 'code', text: `- name: Mark the WordPress path as a safe git directory
  command: git config --global --add safe.directory {{ wp_path }}
  changed_when: false

- name: Clone WordPress from GitHub
  git:
    repo: https://github.com/WordPress/WordPress.git
    dest: "{{ wp_path }}"
    version: master
    force: true` },
  { t: 'h3', text: '1.4 Verification' },
  { t: 'p', text: `The playbook was re-run against the same two hosts without destroying them. The clone task completed and the play recap reported failed=0 on both. The full destroy-and-rebuild cycle was then executed twice more, confirming the playbook is idempotent whether it meets a clean host or a previously configured one.` },
  { t: 'h3', text: '1.5 Lesson applied' },
  { t: 'p', text: `Every task in the deployment playbook was subsequently reviewed against the question of what it would do on a second execution rather than a first. That review is the reason the copy task creating wp-config.php sets force: false, and the reason the site-enable and site-disable commands carry creates and removes guards. A task that only works against a pristine host is a latent failure in any environment that is rebuilt on demand.` },

  { t: 'h2', text: '2. Issue Encountered and Resolution' },
  { t: 'p', text: `A second defect surfaced only on rebuilt environments and repeatedly blocked administrative login, which made it the most disruptive issue of the project because a site that cannot be logged into cannot be demonstrated.` },
  { t: 'h3', text: '2.1 Symptom' },
  { t: 'p', text: `After a fresh rebuild, the WordPress site loaded normally but every login attempt returned to the login screen with no error message. The Apache error log showed repeated PHP warnings pointing at the security-key definitions in wp-config.php:` },
  { t: 'code', text: `PHP Warning: Undefined array key "...long random string..."
in /var/www/html/wordpress/wp-includes/pluggable.php on line 2637` },
  { t: 'h3', text: '2.2 Root cause' },
  { t: 'p', text: `WordPress builds its authentication cookie from a set of secret keys called salts. The original playbook inserted those salts with three separate tasks (uri, lineinfile, and blockinfile). On a fresh clone the inserted block was not valid PHP, so the salt constants were never defined. Without them WordPress could not compute a valid cookie hash, so every login silently failed and bounced back to the form.` },
  { t: 'p', text: `Because the salts are regenerated on each run, the bug reappeared after every teardown and rebuild — the exact scenario the project is graded on — even though the site itself was otherwise healthy.` },
  { t: 'h3', text: '2.3 Resolution' },
  { t: 'p', text: `The three salt tasks were replaced with a single shell task that removes any existing salt lines, fetches fresh salts from the WordPress API, and inserts them as valid PHP in one step. A marker file guards the task so it runs only once and is never rewritten on a re-run:` },
  { t: 'code', text: `- name: Set unique salts in wp-config.php
  shell: |
    set -e
    sed -i "/^define(...KEY|SALT.../d" {{ wp_path }}/wp-config.php
    curl -s https://api.wordpress.org/secret-key/1.1/salt/ > /tmp/wp_salts.txt
    sed -i "/That's all, stop editing/e cat /tmp/wp_salts.txt" {{ wp_path }}/wp-config.php
  args:
    creates: "{{ wp_path }}/.salts_done"` },
  { t: 'h3', text: '2.4 Verification' },
  { t: 'p', text: `The environment was destroyed and rebuilt from a single command, and administrative login succeeded on both droplets immediately, with no manual intervention. The php -l syntax check on the generated wp-config.php reported no errors.` },
  { t: 'h3', text: '2.5 Lesson applied' },
  { t: 'p', text: `A defect that only appears on a rebuild is invisible during ordinary development but fatal to an on-demand environment. After this, every configuration task was tested specifically against a fresh clone rather than an already-working host.` },

  { t: 'h2', text: '3. Issue Encountered and Resolution' },
  { t: 'p', text: `A third defect appeared only after the full stack was running and was caused by the memory ceiling the project specification imposes, making it a genuine infrastructure constraint rather than a coding error.` },
  { t: 'h3', text: '3.1 Symptom' },
  { t: 'p', text: `After a successful deployment, the WordPress site would intermittently return "Error establishing a database connection" in the browser, even though the same site had loaded correctly moments earlier. Apache and PHP were still serving; only the database layer was affected.` },
  { t: 'h3', text: '3.2 Root cause' },
  { t: 'p', text: `Each droplet is limited to 1 GB of memory by the project specification. Apache, PHP, and MariaDB together leave very little headroom, and under load the Linux out-of-memory killer terminates the largest process, which is MariaDB. With the database process killed, WordPress could no longer connect, producing the error above. The site had not been misconfigured — it had simply run out of memory.` },
  { t: 'h3', text: '3.3 Resolution' },
  { t: 'p', text: `The database service is declared in the playbook with a running, enabled state, so re-running the deployment restores it rather than requiring a manual restart:` },
  { t: 'code', text: `- name: Ensure MariaDB is running
  service:
    name: mariadb
    state: started
    enabled: true` },
  { t: 'p', text: `For a longer-term fix, adding a small swap file gives the kernel somewhere to page memory instead of killing the database, which prevents the failure under the same 1 GB limit.` },
  { t: 'h3', text: '3.4 Verification' },
  { t: 'p', text: `After re-converging the environment, MariaDB returned to a running state and the site loaded consistently. Monitoring memory during a full page load confirmed the stack operated within the 1 GB ceiling once swap was available.` },
  { t: 'h3', text: '3.5 Lesson applied' },
  { t: 'p', text: `A resource limit that looks generous while a system is built piece by piece can fail once every service runs at once. Constraints must be tested under real load, not just at install time, and configuration management restores a drifted service by re-converging it rather than repairing it by hand.` },

  { t: 'h2', text: '4. Demonstration Procedure' },
  { t: 'p', text: `The following sequence is executed live. It assumes the DigitalOcean account has been emptied by the systems administrator beforehand.` },
  { t: 'ul', items: [
    `From the workstation terminal, start and enter the control node: <code>multipass start ansible-vm</code> followed by <code>multipass shell ansible-vm</code>.`,
    `Change to the project directory: <code>cd ~/wordpress-project</code>.`,
    `Show the DigitalOcean console to confirm no project droplets exist.`,
    `Run the full build: <code>ansible-playbook site.yml --ask-vault-pass</code>, and supply the vault password. This is the only manual input required.`,
    `While the playbook runs, narrate the task names as they scroll: SSH key upload, droplet creation, SSH wait, package installation, firewall rules, database creation, Git clone, configuration edit, virtual host.`,
    `On completion, show the play recap reporting failed=0 for both hosts.`,
    `Refresh the DigitalOcean console to show both correctly named droplets now active.`,
    `Browse to both public IP addresses to show WordPress serving from each, completing the installation wizard and logging in to the dashboard to confirm full functionality.`,
  ] },
  { t: 'p', text: `<strong>Contingency.</strong> If the apt mirror returns 404 errors during the demonstration, the recovery is to add a task pointing the droplets at archive.ubuntu.com in place of the DigitalOcean mirror. Having that snippet prepared in advance converts a failed demonstration into a demonstrated troubleshooting capability.` },
  { t: 'code', text: `- name: Use the main Ubuntu archive instead of the DO mirror
  replace:
    path: /etc/apt/sources.list
    regexp: 'mirrors\\.digitalocean\\.com/ubuntu'
    replace: 'archive.ubuntu.com/ubuntu'` },
];

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Build a short id from a heading, for the table-of-contents anchors.
function slug(text) {
  return String(text).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function renderBlock(b) {
  switch (b.t) {
    case 'title':
      return `<h1 class="doc-title">${escapeHtml(b.text)}</h1>`;
    case 'h1':
      return `<h2 id="${slug(b.text)}" class="sec">${escapeHtml(b.text)}</h2>`;
    case 'h2':
      return `<h3 class="sub">${escapeHtml(b.text)}</h3>`;
    case 'h3':
      return `<h4 class="step">${escapeHtml(b.text)}</h4>`;
    case 'p':
      // paragraphs may contain intentional inline HTML (<code>, <strong>, <em>)
      return `<p>${b.text}</p>`;
    case 'note':
      return `<div class="note">${b.text}</div>`;
    case 'code':
      return `<pre><code>${escapeHtml(b.text)}</code></pre>`;
    case 'ul':
      return `<ul>${b.items.map(i => `<li>${i}</li>`).join('')}</ul>`;
    case 'table': {
      const head = `<tr>${b.head.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
      const body = b.rows.map(r =>
        `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('');
      return `<div class="table-wrap"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
    }
    default:
      return '';
  }
}

function renderToc(blocks) {
  const items = blocks
    .filter(b => b.t === 'h1')
    .map(b => `<a href="#${slug(b.text)}">${escapeHtml(b.text)}</a>`)
    .join('');
  return `<nav class="toc">${items}</nav>`;
}

function render(blocks) {
  const body = blocks.map(renderBlock).join('\n');
  const generated = new Date().toISOString().slice(0, 16).replace('T', ' ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Scope of Work — ansible-wordpress</title>
<style>
  :root {
    --bg: #0d1117;
    --panel: #131a24;
    --panel-2: #1a2330;
    --line: #24303f;
    --ink: #e6edf3;
    --muted: #8b98a9;
    --teal: #1fe0c4;
    --teal-dim: #0f8f7f;
    --warn: #e3b341;
    --mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
    --sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font-family: var(--sans); line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 920px; margin: 0 auto; padding: 48px 24px 96px; }

  .kicker { font-family: var(--mono); color: var(--teal); font-size: 13px; letter-spacing: .04em; }
  .doc-title {
    font-size: 36px; font-weight: 650; letter-spacing: -0.02em;
    margin: 8px 0 4px;
  }
  .byline { color: var(--muted); font-size: 14px; margin-bottom: 8px; }
  .byline .mono { font-family: var(--mono); color: var(--ink); }

  .toc {
    display: flex; flex-wrap: wrap; gap: 8px 16px;
    border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
    padding: 18px 0; margin: 28px 0 40px;
  }
  .toc a { color: var(--muted); text-decoration: none; font-size: 13px; }
  .toc a:hover { color: var(--teal); }

  h2.sec {
    font-size: 24px; font-weight: 620; margin: 48px 0 16px;
    padding-top: 20px; border-top: 1px solid var(--line);
    letter-spacing: -0.01em; scroll-margin-top: 20px;
  }
  h3.sub { font-size: 19px; font-weight: 600; margin: 32px 0 12px; color: var(--ink); }
  h4.step {
    font-size: 15px; font-weight: 600; margin: 24px 0 10px;
    color: var(--teal); font-family: var(--mono);
  }
  p { margin: 12px 0; }
  code {
    font-family: var(--mono); font-size: .88em;
    background: var(--panel-2); color: var(--teal);
    padding: 1px 6px; border-radius: 5px;
  }
  pre {
    background: var(--panel); border: 1px solid var(--line);
    border-left: 3px solid var(--teal-dim);
    border-radius: 8px; padding: 16px 18px; overflow-x: auto; margin: 16px 0;
  }
  pre code {
    background: none; color: var(--ink); padding: 0;
    font-size: 13px; line-height: 1.55;
  }
  .note {
    background: color-mix(in srgb, var(--warn) 8%, var(--panel));
    border: 1px solid color-mix(in srgb, var(--warn) 30%, transparent);
    border-left: 3px solid var(--warn);
    border-radius: 8px; padding: 12px 16px; margin: 16px 0;
    font-size: 14px; color: var(--ink);
  }
  .note code { background: color-mix(in srgb, var(--warn) 14%, var(--panel-2)); color: var(--warn); }
  ul { margin: 12px 0; padding-left: 22px; }
  li { margin: 7px 0; }

  .table-wrap { overflow-x: auto; margin: 18px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--panel-2); vertical-align: top; }
  thead th { color: var(--teal); font-weight: 600; border-bottom: 1px solid var(--line); font-family: var(--mono); font-size: 12px; }
  tbody tr:hover td { background: var(--panel); }

  footer { margin-top: 56px; padding-top: 20px; border-top: 1px solid var(--line);
           color: var(--muted); font-size: 12px; font-family: var(--mono); }

  @media (max-width: 640px) {
    .doc-title { font-size: 28px; }
    .wrap { padding: 32px 16px 64px; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="kicker">ansible-wordpress · PP6 · term 2608</div>
    <div class="byline">
      Charles Tull · Full Sail University ·
      targets <span class="mono">TullC-2608-WP1</span> &amp; <span class="mono">TullC-2608-WP2</span>
    </div>
    ${renderToc(blocks)}
    ${body}
    <footer>Generated ${generated} · ${blocks.length} blocks · Charles Tull</footer>
  </div>
</body>
</html>`;
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */
function main() {
  const outArg = process.argv[2] || path.join('docs', 'report.html');
  const html = render(report);
  fs.mkdirSync(path.dirname(path.resolve(outArg)), { recursive: true });
  fs.writeFileSync(outArg, html, 'utf8');
  const counts = report.reduce((m, b) => (m[b.t] = (m[b.t] || 0) + 1, m), {});
  console.log(`Wrote ${outArg}`);
  console.log(`  ${report.length} blocks — ` +
    Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', '));
}

main();
