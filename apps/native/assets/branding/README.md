# Kiro JP launcher artwork

The original vector mark combines 日 (Japanese text) with a conversation tail. Its white and orange artwork uses the app's reference palette on an indigo background. It contains no font or external artwork dependencies.

- `kiro-mark.svg`: editable transparent vector master.
- `icon.png`: opaque 1024 × 1024 launcher/project icon, indigo `#37469E` background.
- `adaptive-foreground.png`: transparent 1024 × 1024 Android foreground.
- `adaptive-monochrome.png`: the same alpha silhouette in white for Android themed icons.

The foreground stays within Android's central 66/108 safe circle. Do not bake rounded corners or a device frame into these assets; the launcher applies its own mask.
