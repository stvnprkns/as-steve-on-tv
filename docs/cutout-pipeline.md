# Steve cutout pipeline

## Purpose

Turn a source screenshot into a transparent, tightly cropped cutout that can sit on the collage, plus the files needed for hit-testing and rights review.

Do not auto-publish stills. Screenshots and publicity images are generally copyrighted. The original file, attribution, and a `displayAllowed=false` default stay with every cutout until an editor says otherwise.

## Output for each Steve

| File | Role |
| --- | --- |
| Original screenshot | Quality control and rights trail |
| Transparent cutout (WebP) | What appears on the collage |
| Silhouette mask (PNG) | Click hits on the visible shape, including when Steves overlap |
| JSON sidecar | Metadata, crop, provider, entry link, rights |

Prefer head-and-upper-body cutouts so clothing and pose survive. Face-only is allowed when that is all the frame gives.

## Pipeline

1. Editor uploads a source frame in the cutout studio, or a CLI path is passed to `npm run cutout:process`.
2. If several people are in the frame, the editor draws a box around Steve. That crop is the only region sent onward.
3. Background removal runs through remove.bg when `REMOVEBG_API_KEY` is set. If the upload is already a transparent PNG, a local passthrough trims it instead.
4. The pipeline extracts the alpha mask, trims empty pixels, and writes the four outputs under `content/cutouts/`.
5. The editor reviews the cutout on a checkerboard. Nothing is collage-public until status is `collage-ready` **and** `imageRights.displayAllowed` is true.

SAM 2 and local rembg are deferred until 30–50 real cutouts have been processed and the failure modes are known.

## Editorial studio

Local-only tool at `/admin/cutouts`.

- Upload an image
- Draw a selection around Steve when the frame is crowded
- Review the transparent result
- Link an existing archive entry when there is one
- Keep source URL, title, and license basis
- Save the mask beside the cutout

This is not a public CMS and not a batch scraper. It does not download stills from IMDb or TMDB.

## CLI

```bash
REMOVEBG_API_KEY=... npm run cutout:process -- \
  --file ./private/frames/harrington.png \
  --name "Steve Harrington" \
  --entry steve-harrington-stranger-things \
  --source-title "Stranger Things" \
  --license-basis "screenshot-held-for-review"
```

`--roi=x,y,w,h` and `--id` optional. `--id` pins the sidecar to an archive slug. Apostrophes are stripped so `Blue's Clues` becomes `blues-clues`, not `blue-s-clues`. Without an API key, the file must already have an alpha channel.

## Rights

- Default `displayAllowed` is false.
- Originals live on disk for review; they are not copied into `public/`.
- Public collage routes refuse cutouts that are not displayable.
- Layout-fixture images used in tests are synthetic and labeled as such.

## Scaling later

After the first few dozen editorial cutouts: keep the same sidecar schema, swap the provider behind `CutoutProvider`, and consider SAM 2 for crowded frames. Do not build a custom segmenter before the collage looks right.
