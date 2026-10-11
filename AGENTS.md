<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- The active dataset (`ds` in `src/routes/index.tsx`) is the single source of truth; it is replaced only after `parseWorkbook` succeeds, never merged; why: uploads must fully replace old data and failures must keep the last valid data.
- Columns are mapped to roles by header aliases; missing roles hide features instead of crashing; why: Excel structure may change.
- The latest successful upload is kept in browser IndexedDB (`src/lib/latestUpload.ts`, single "latest" key) and wins over `public/data/tickets.xlsx` on startup and Reload; why: users must never see an older workbook after uploading a newer one, and no backend is enabled.
- FCN and CRM timeline durations are computed from their own date columns, separately from normal-call TAT; why: their closure concepts differ and must never be mixed.
