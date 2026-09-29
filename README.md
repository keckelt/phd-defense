# PhD defense: Visualizing Differences

_Interactive Characterization and Comparison of High-Dimensional Data Sets_

Slides of my PhD defense at Johannes Kepler University Linz, held on 28 September 2026.
Built with [reveal.js](https://revealjs.com), [D3](https://d3js.org) and [Vite](https://vite.dev).

**View the slides:** https://keckelt.github.io/phd-defense/

- Arrow right and left step through the talk.
- After the last slide, the appendix has one column per topic. Arrow right picks a column, arrow down walks it.
- Press `F` for full screen and `Esc` for an overview.

Most charts are drawn live from a synthetic cohort in [`data/`](data/). The patients are made up;
the gene names are real.

## Run it locally

```sh
npm ci
npm start       # Dev server with hot reload
npm run build   # Static site in dist/
npm run pdf     # Build and open the print view for a PDF export
```

## License

The **code** (JavaScript, CSS, HTML structure and build setup) is available under the [MIT license](LICENSE).

The MIT license does **not** cover the figures, screenshots, logos or slide text. They keep their
original copyright and license, listed below.

## Figures and credits

Figures from open-access papers, reused under their license:

- **Loops**: K. Eckelt, K. Gadhave, A. Lex, M. Streit. _Loops: Leveraging Provenance and Visualization
  to Support Exploratory Data Analysis in Notebooks._ IEEE TVCG, 2025.
  [doi:10.1109/TVCG.2024.3456186](https://doi.org/10.1109/TVCG.2024.3456186).
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Embeddings**: K. Eckelt, A. Hinterreiter, P. Adelberger, C. Walchshofer, V. Dhanoa, C. Humer,
  M. Heckmann, C. Steinparz, M. Streit. _Visual Exploration of Relationships and Structure in
  Low-Dimensional Embeddings._ IEEE TVCG, 2023.
  [doi:10.1109/TVCG.2022.3156760](https://doi.org/10.1109/TVCG.2022.3156760).
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Marjorie**: A. Scimone, K. Eckelt, M. Streit, A. Hinterreiter. _Marjorie: Visualizing Type 1
  Diabetes Data to Support Pattern Exploration._ IEEE TVCG, 2024.
  [doi:10.1109/TVCG.2023.3326936](https://doi.org/10.1109/TVCG.2023.3326936).
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Kokiri**: K. Eckelt, P. Adelberger, M. J. Bauer, T. Zichner, M. Streit. _Kokiri: Random-Forest-Based
  Comparison and Characterization of Cohorts._ IEEE VIS Workshop on Visualization in Biomedical AI, 2022. [doi:10.1101/2022.08.16.503622](https://doi.org/10.1101/2022.08.16.503622).
  [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/).

Figures whose copyright lies with the publisher or the authors:

- **Coral**: P. Adelberger, K. Eckelt, M. J. Bauer, M. Streit, C. Haslinger, T. Zichner. _Coral: a
  web-based visual analysis tool for creating and characterizing cohorts._ Bioinformatics, 2021.
  [doi:10.1093/bioinformatics/btab695](https://doi.org/10.1093/bioinformatics/btab695).
  © The Author(s) 2021. Published by Oxford University Press. All rights reserved.
- **TourDino**: K. Eckelt, P. Adelberger, T. Zichner, A. Wernitznig, M. Streit. _TourDino: A Support
  View for Confirming Patterns in Tabular Data._ EuroVA, 2019.
  [doi:10.2312/eurova.20191117](https://doi.org/10.2312/eurova.20191117).
  © 2019 The Author(s). Eurographics Proceedings © 2019 The Eurographics Association.
- **TourGuide poster**: D. Fuchs et al. OeGHO and AHOP Spring Conference, Linz, 2019.
- **Explainable pattern detection**: Bittner, Hinterreiter, Eckelt, Streit. ECML PKDD 2025.
  © 2025 The Author(s), under exclusive license to Springer Nature Switzerland AG.

Other material:

- The **sensemaking framework** figure is adapted from Thomas and Cook (2005), based on Pirolli and
  Card (2005).
- The **Avivator** screenshot shows third-party software.
- **Logos** of Johannes Kepler University Linz, the Visual Data Science Lab, Boehringer Ingelheim
  and Kepler University Hospital are trademarks of their owners.
