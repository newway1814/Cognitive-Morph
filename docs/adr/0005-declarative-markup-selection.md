# Use Declarative Data Attributes for Content Selection

To identify layout components, we will use explicit developer-defined markup (`data-morph="main"` and `data-morph="peripheral"`), falling back to standard semantic HTML tags (like `<main>` or `<article>`) when these attributes are absent. This avoids the fragility and performance overhead of dynamic text-density heuristics while giving developers precise control over which areas morph.
