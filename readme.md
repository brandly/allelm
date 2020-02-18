set `TOKEN` to a [GitHub access token](https://github.com/settings/tokens).

```
# scrape `elm.json` files into ./packages
$ TOKEN=abc123 node index.js

# find exact versions for each dependency
$ find ./packages -name '*.json' | node build-graph.js
```
