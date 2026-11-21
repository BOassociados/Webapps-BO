# Motor do Conversor PDF/A

| Ficheiro | O que é | Licença |
|---|---|---|
| `gs.js`, `gs.wasm.gz` | Ghostscript 10.06 compilado para WebAssembly (o `.wasm` vai comprimido em gzip) | AGPL-3.0 |
| `pdf-lib.min.js` | pdf-lib | MIT |
| `worker.js` | Código da BO que corre a conversão fora da página | — |

O código-fonte do Ghostscript está em https://ghostscript.com/releases/ e https://git.ghostscript.com/.
O da pdf-lib está em https://github.com/Hopding/pdf-lib.

A conversão corre toda no browser: os PDF nunca saem do computador.
