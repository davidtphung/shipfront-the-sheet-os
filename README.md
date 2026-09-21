# Shipfront: THE SHEET OS

A static marketing site for Shipfront, warehousing and fulfillment at 1933 S. Broadway, Los Angeles.

THE SHEET OS is a sibling build. It takes the chrome and interaction language of the Crate-OS
sibling (floating compact nav, an order-flow hero panel, a sticky network node graph, illustrative
workflow rails, interruptible sheets) and repaints all of it into THE SHEET: white ground, black
ink, and one signal orange.

## Paint lock

| Token | Value | Use |
| --- | --- | --- |
| `--ground` | `#FFFFFF` | Page ground |
| `--type` | `#000000` | Ink |
| `--slate` | `#475569` | Muted body |
| `--signal` | `#FF6A00` | The only accent |

Rules that hold everywhere in this repo:

- The CTA label is black on orange. Never white on orange.
- Orange is used as fill, border, and rule. It is never used as body text on white.
- There is exactly one deep-night section, the `#network` pause. It is neutral black with SHEET
  orange, not a navy and cyan clone.
- Display type is Space Grotesk, UI is Geist, numerals are JetBrains Mono. All six faces are
  self-hosted in `fonts/`.

## Pages

| Path | Page |
| --- | --- |
| `/` | Home |
| `/quote/` | Get a Quote |
| `/contact/` | Contact |

## What is on the home page

1. Floating nav that compacts onto a white plate after scroll and springs out of the way on the way down.
2. Hero with the order-flow panel: STORE, ORDER, INVENTORY, PICK, PACK, SHIP, DELIVER. Labeled illustrative. The panel walks those seven stations. On a phone it becomes a vertical rail you can hold on a step.
3. On the floor chip band.
4. `#network`, a sticky node graph across STORE, INVENTORY, FULFILLMENT, QUALITY CHECK, CARRIER,
   and CUSTOMER. Desktop track is capped at 160vh and does not hijack scroll. Mobile falls back to a
   vertical list. Hover, focus, and press all resolve to the same state.
5. How it works, three steps from inbound to the customer.
6. Why Shipfront: Warehousing, Fulfillment, eCommerce Integrations, Location.
7. Closing plate and footer.

## Forms

Name, email, and company only. No phone. The form validates in the browser and posts nothing to a
server. It is a preview. Real mail goes to info@myshipfront.com.

## Motion

- Transform and opacity only.
- Press scale is 0.97 with a critically damped spring, bounce 0.
- Sheets for the mobile menu and the quote flow are interruptible: a drag can take over a running
  presentation mid-flight, and a flick hands velocity to the dismissal.
- `prefers-reduced-motion: reduce` drops every travel and the ambient loops, and cross-fades instead.

## Binary assets

The four photos and six woff2 faces are byte-locked and shared verbatim with the sibling SHEET
build. `tools/assets.sha256` is the contract. If a checkout is missing them, run:

```bash
bash tools/restore-assets.sh
```

It fetches only what is absent and then verifies every file, so a re-encoded or truncated asset
fails the run instead of shipping.

## Run it locally

No build step. Any static server works.

```bash
bash tools/restore-assets.sh
python3 -m http.server 43117
```

Then open http://127.0.0.1:43117/.

## Deploy

`.github/workflows/pages.yml` restores and verifies the binary assets, then publishes the repo root
to GitHub Pages. It needs Pages set to build from GitHub Actions in repository settings.
`.nojekyll` is present so every path is served as-is.

Built by David T Phung.
