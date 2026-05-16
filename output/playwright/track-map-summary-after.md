# Track Map Sample Summary After Fix

- URL: http://localhost:5173/?event=50&config=w3&tab=trackmap
- Duration: 118.5s
- Samples: 53
- Visible markers first/last: 133/144
- PID0 frames seen: 226
- PID4 frames seen: 2
- Track length (feed): 25378
- Main SVG path length: 2019.0848388671875
- Sector marker lengths/dashes captured: 9/10
- Intermediate sample counts: 1=535, 2=1396, 3=214, 4=1809, 5=620, 6=2258, 7=163, 8=202, 10=141
- Jumps >40 SVG units between 1s samples (pre-fix baseline): 199
- Jumps >40 SVG units after ETA math + staleness guard fix: 0  ✓  (validated via `npm run replay:trackmap`)
- Zero-duration rows near finish (>1900 SVG units): 0

## Jump Histogram After Fix (from `npm run replay:trackmap`)

```
> 5  units   266  ██████████████████████████████████████████████████
>10  units     9  ███
>20  units     5  ██
>40  units     0
>80  units     0
>150 units     0
```

Reduction: 199 → 0 jumps >40 SVG units (100% eliminated; target was ≥95%).

## Root Cause Fixed

`ETA` was previously interpreted as "time to next intermediate" but is actually the
**predicted lap-completion time** (server clock, ms).  With 9 sectors of varying length
(S4=696 m vs S7=7297 m), treating ETA as finish-line time and weighting per-sector time
proportionally to sector length produced physically plausible speeds (~60–170 km/h)
instead of the previous ~3–12 m/s (impossible for S7).

Secondary fix: per-car staleness guard (`TrackDriverHistory`) prevents stale PID 0
snapshots from pulling markers backwards (eliminated `#189 IM 5→4` regressions).

Tertiary fix: per-frame EMA (τ=250 ms) in `TrackMapPanel` absorbs any residual jitter
from refined ETAs.

## Sector Markers
- S1: x=203.7 y=524.5
- S2: x=274.2 y=422.8
- S3: x=149.1 y=291.5
- S4: x=118.1 y=248.2
- S5: x=346.5 y=43.3
- S6: x=466.1 y=107.1
- S7: x=439.8 y=308.1
- S8: x=343.3 y=368.0
- S9: x=246.7 y=465.2
