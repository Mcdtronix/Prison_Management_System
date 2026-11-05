# Grammar checking for messaging (optional)

The message editor has a **Check spelling and grammar** button. It appears
only when the server is configured with a LanguageTool checker running **on
this same machine**. Message text goes from the browser to Django, from
Django to `127.0.0.1:8081`, and nowhere else.

Spelling underlines while typing come from the browser's own spell checker and
need no setup.

## What it costs

* About 0.5–1 GB of RAM (capped at 1 GB by the service file).
* One download during installation. After that the checker runs offline.

## Install (Ubuntu, as root)

```bash
apt-get install -y openjdk-17-jre-headless unzip

# One-time download of the checker itself.
cd /tmp
curl -fLO https://languagetool.org/download/LanguageTool-stable.zip
unzip -q LanguageTool-stable.zip
rm -rf /opt/languagetool
mv LanguageTool-*/ /opt/languagetool
rm -f LanguageTool-stable.zip

# A dedicated account with no login and no home directory.
useradd --system --no-create-home --shell /usr/sbin/nologin languagetool || true
chown -R root:languagetool /opt/languagetool
chmod -R o-rwx /opt/languagetool

cp /var/www/pms/current/deploy/systemd/languagetool.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now languagetool
```

Check it answers (allow about 20 seconds after the first start):

```bash
curl -s --data "language=en-GB&text=Their is a error here." http://127.0.0.1:8081/v2/check | head -c 300
```

## Switch it on in PMS

Add to `/var/www/pms/shared/.env`:

```
LANGUAGETOOL_URL=http://127.0.0.1:8081
LANGUAGETOOL_LANGUAGE=en-GB
```

Then restart the app: `systemctl restart pms`. The button appears for
everyone the next time they open the editor.

## Switch it off

Remove `LANGUAGETOOL_URL` from `.env`, restart `pms`, then
`systemctl disable --now languagetool`.

## How the data stays on this server

* LanguageTool listens on `127.0.0.1` only (it is started without `--public`).
* The service file sets `IPAddressDeny=any` and `IPAddressAllow=localhost`,
  so the process cannot open any connection off this machine.
* The browser never talks to LanguageTool directly; only signed-in users can
  reach it, through `POST /api/messaging/grammar/`, at most 20,000
  characters at a time.
