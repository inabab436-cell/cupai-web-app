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

- Preserve the pinned TanStack bootstrap and CSRF middleware when importing source; this keeps the app compatible with the hosted runtime.
- Source database calls use a server-only compatibility adapter around generated Cloud clients; never overwrite generated integration files.
- Track migration capabilities and blockers separately; bundled source is not a verified data or identity migration.
