# HLBM visual reference manifest

Curated imports from the sibling `hold_less_be_more` repository. Rune Foundry has no
runtime dependency on that repository, and Unity `.meta` files are never copied.

| Source | Destination | Rune Foundry usage |
| --- | --- | --- |
| `Assets/Art/Generated/Resources/Art/Pixel/UI/icon_gem.png` | `public/assets/hlbm/icon_gem.png` | Shards resource marker |
| `Assets/Art/Generated/Resources/Art/Pixel/UI/icon_seal.png` | `public/assets/hlbm/icon_seal.png` | Core resource marker |
| `Assets/Art/Generated/Resources/Art/Pixel/Environments/black_iron_forge.png` | `public/assets/hlbm/black_iron_forge.png` | Subdued Canvas environment beneath the grid |

Reviewed but intentionally not imported:

- HLBM elemental Rune portraits: their Fire/Water/Nature/etc. meanings do not map to
  Rune Foundry's seven Shape identities.
- HLBM enemy sprites: current Rune Foundry gameplay has no enemy entities.
- `icon_ring.png`: it reads as equipment and would be a forced Engine/Beacon mapping.

Rune Foundry-specific geometric marks and the carved Rune tile live under
`public/assets/rune-foundry/` and in the shared UI stylesheet.
