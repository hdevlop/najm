# Changelog

## 2.1.48 - 2026-08-04

- Keep responsive card row actions visible on phone, tablet, and touch input,
  while retaining hover and keyboard-focus reveal on fine-pointer desktops.
- Size table and card loading skeletons from the measured body and active grid,
  and keep loading borders, radius, color, and shadow aligned with loaded
  surfaces.
- Add the exported `NTableCardPagination` and `NTableLoadMorePagination`
  contracts for paged, complete supplied-data, and explicit server-backed Load
  more card presentation, including guarded append/retry behavior and accessible
  loading, result, error, and terminal feedback.
