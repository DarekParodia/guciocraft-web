// Dane publiczne. Po zmianie tego pliku wykonaj ponownie npm run build.
export const site = {
  name: 'guciocraft',
  address: 'mc.bshomelab.cc',
  discord: 'https://discord.gg/A8qsssD8VQ',
  map: 'https://mcmap.bshomelab.cc',
  background: {
    image: 'https://cdn.modrinth.com/data/ZzjhlDgM/images/37e664fcc9f8613913419ade4219dc81a44f423e.png',
    source: 'https://modrinth.com/mod/create-steam-n-rails/gallery',
  },
  modpack: {
    version: null, // np. '2026.11.1' — wersja własnej paczki, nie wersja upstream.
    minecraft: null,
    ramGiB: null, // Ilość RAM przydzielana grze, uzupełnij po sprawdzeniu paczki.
    systemRamGiB: null,
    diskGiB: null,
    updatedAt: null,
  },
  downloads: { modpack: 'guciocraft-modpack.zip', portable: 'guciocraft-prism-windows.zip' },
};
