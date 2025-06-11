# next-virtual-components

`React.lazy` for RSC.

This plugin globs files and reexports components through two entry points: one for the RSC module graph and another for the client module graph.

## What does this solve

Say you have some components that you want to dinamically render based on a prop.

```
src
└── components
    ├── Foo.tsx
    ├── Bar.tsx
    ├── Baz.tsx
    └── Render.tsx
```

- `Foo.tsx` is poisoned with `server-only`.
- `Bar.tsx` is poisoned with `client-only`.
- `Baz.tsx` is a Client Component that renders `Render.tsx`.

If you write `Render` like so, your project will break:

```tsx
function Render({ component }: { component: string }) {
  const Component = React.lazy(() => import(`@/components/${component}`))

  return <Component />
}
```

- On the client, being able to import `Foo` poisons `Render`.
- On the server, being able to import `Bar` poisons `Render`.
- On the server, where bundle size is not as critical, you would be creating a waterfall and suspending for every dynamic import.
- During build time, You would be creating a client bundle for `Foo`, which is server-only.

This library fixes these issues:

```tsx
import * as Components from "components"

function Render({ component }: { component: string }) {
  const Component = Components[component]

  return <Component />
}
```

Under the hood:

- On the server, components are reexported. Rendering a component from the server entry point doesn't suspend.
- On the client, components are lazily imported in order to three shake. Rendering a component from the client entry point suspends.
- Components marked as `server-only` or `client-only` will be automatically removed from the subsequent import map.

## Ideas

- Maybe resolve and check every import for `*-only`
- Maybe expose `components/shared` with a list of server-only/client-only names, or env vars or something like it
- Maybe allow a `lazy: true` option that also lazily imports on the server
- Try to resolve the types issue
