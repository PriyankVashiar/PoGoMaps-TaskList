# Pokémon artwork (removed from vendoring)

Encounter icons are loaded at runtime from the [PokeAPI sprites](https://github.com/PokeAPI/sprites) CDN:

```text
https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{id}.png
```

See `getPokemonArtworkUrl()` in `script.js`.

## Fully removing tracked files from git

If this folder still contains committed PNGs, remove them from the index (keeps history smaller on future clones only after a history rewrite):

```bash
git rm -r --cached assets/pokeapi-official-artwork
# keep this README if desired:
git add assets/pokeapi-official-artwork/README.md
git commit -m "chore: stop tracking vendored Pokémon artwork (CDN)"
```

The path is listed in `.gitignore` so the bulk set is not re-added by mistake.
