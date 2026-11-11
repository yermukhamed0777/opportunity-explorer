# Deployment recovery — 11 November 2026

The production Vercel deployment `dpl_D4iodcdRr6SXFKscibu7T4fgUVxw` was marked READY but its source tree contained no `dist/index.html`, `dist/app.js` or `dist/styles.css`. Its `out` tree contained only the two feed functions. The production root therefore returned Vercel's 404 page. A successful deployment status did not prove a usable frontend.

The last complete deployment available for inspection was `dpl_6rkJknYeQtsWih1Y5YefUDJw6pz7`. Its HTML, JavaScript and CSS could be fetched. The latest GitHub revision was `b287a5382c5adf33c7b7a789c048492fb2ee41c3`; it included additional reliability fixes and tests. The original GitHub revision is preserved in `backup/pre-prospectoai-2026-11-11`.

The recoverable Vercel frontend and repository share the forest-green layout, application tracker, comparison, calendar and backup features. The repository version includes readable formatting and failure-recovery checks. The feed sources and the existing private Blob path are preserved.

The screenshots supplied for the later external-editor work show local Windows paths and line counts, rather than a patch. Those claimed later edits are not present in the broken Vercel release. Their exact text cannot be reconstructed from the screenshots. They have not been represented as recovered or reviewed. Original source exports or a patch would be needed to reconcile those edits precisely.

The new build validates that all required frontend files exist. Source, deployment settings and database migrations are versioned together. Generated browser bundles are created from `src/` during the build.
