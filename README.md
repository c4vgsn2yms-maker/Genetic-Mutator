# Genetic Mutator

Browser-based generational genetics and selective-breeding simulator.

This repository is a clean GitHub implementation built from the Genetic Mutator project requirements. It is not a byte-for-byte export of the existing hosted ChatGPT Site.

## Current MVP goals

- Feline genome schema
- Persistent genotype -> phenotype inheritance
- Manual breeding
- Functional Auto Breed
- Separate lineages
- Cross-lineage breeding
- Metric / imperial display
- Uncapped genetic weight progression (with numeric safety only)
- Pigmentation mutations: melanism, albinism, leucism, piebald
- Expanded coat colors
- Deterministic procedural cat appearance
- Local browser saves

## Planned online layer

Authentication, cloud saves, shared lineages, stud marketplace, animal sales/trades, and credits require a real shared backend and will be added separately so these features are not faked with browser-only state.

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.
