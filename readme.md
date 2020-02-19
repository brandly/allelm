# allelm

Generate a dependency graph for every Elm package to be [viewed in `pm`](https://github.com/anvaka/pm).

## usage

set `TOKEN` to a [GitHub access token](https://github.com/settings/tokens).

```
$ git clone https://github.com/brandly/allelm.git
$ cd allelm
$ npm install

# scrape `elm.json` files into ./packages
$ TOKEN=abc123 node index.js

# find exact versions for each dependency, calculate layout
# produces .bin files in data/
$ find ./packages -name '*.json' | node build-graph.js
```

## prior art

- [allgithub](https://github.com/anvaka/allgithub)
- [allnpm](https://github.com/anvaka/allnpm)
- [allbower](https://github.com/anvaka/allbower)
- [and more](https://github.com/anvaka?utf8=%E2%9C%93&tab=repositories&q=all&type=&language=)
  ...
