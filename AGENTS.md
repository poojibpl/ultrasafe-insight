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

- Dashboard data is parsed client-side from `public/data/tickets.xlsx` (or a user-opened file) via SheetJS in `src/lib/tickets.ts`; why: data must always mirror the real Excel with no backend copy.
- Columns are mapped to roles by header aliases; missing roles hide features instead of crashing; why: Excel structure may change.
