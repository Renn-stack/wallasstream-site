# Hero cinematic assets

## Shipped
| File | Size | Use |
|---|---|---|
| `hero-cine-1920.mp4` | 1573 KB | plate, viewports where innerWidth × DPR > 1600 |
| `hero-cine-1280.mp4` | 719 KB | plate, narrower desktops |
| `hero-cine-poster.jpg` | 20 KB | CSS background on the stage; covers pre-decode |

## Sources — DO NOT DEPLOY
| File | Size | Notes |
|---|---|---|
| `hero-cine-corrected.mov` | 26.1 MB | the manually graded master (HEVC 4K, 8.37s). Both mp4s are scale-only transcodes of this file — no crop, no filters, bt709 tags carried through. Verified max ΔL 0.25/255 against source. |
| `hero-master.mp4` | 22.8 MB | the original Higgsfield generation, superseded |
| `frames/` | — | stills extracted for composition review |

Exclude `*.mov`, `hero-master.mp4` and `frames/` from the deploy (e.g. via
`.vercelignore`) — they are 49 MB of source material with no runtime use.

## Regenerating the web cuts
```
ffmpeg -i hero-cine-corrected.mov -an -vf "scale=1920:-2:flags=lanczos" \
  -c:v libx264 -preset slow -crf 26 -g 6 -keyint_min 6 -sc_threshold 0 \
  -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -color_range tv -movflags +faststart hero-cine-1920.mp4
```
`-g 6` is deliberate: dense keyframes are what make scroll-scrubbing seek smoothly.
