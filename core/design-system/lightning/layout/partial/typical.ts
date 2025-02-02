import * as ldsGovn from "../../governance.ts";
import * as dia from "./diagrams.ts";
import * as ext from "./extensions.ts";

export const typicalBodyPartial: ldsGovn.LightningPartial = (_, body) =>
  body || "<!-- no lightningBody -->";

// deno-fmt-ignore (because we don't want ${...} wrapped)
export const typicalHeadPartial: ldsGovn.LightningPartial = (layout) => `
${layout.contributions.head.contributions("fore").contributions.join("\n")}
<meta charset="utf-8" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="dns-prefetch" href="https://cdnjs.cloudflare.com">
<link href="https://cdnjs.cloudflare.com" crossorigin>
<link rel="stylesheet preload" as="style" href="https://cdnjs.cloudflare.com/ajax/libs/design-system/2.14.2/styles/salesforce-lightning-design-system.min.css" integrity="sha512-v9eTZELqSZcRlIRltjIbpM55zkTQ9azkDAjI0IByyjHLWty1U2+CSPtnNxGpC3FFkpsKwAOfciCv4PWhW/pQGw==" crossorigin="anonymous" />
<link rel="stylesheet" href="${layout.contentStrategy.assets.dsStylesheet("/lightning-customize.css")}">
<link rel="stylesheet" href="${layout.contentStrategy.assets.uStylesheet("/markdown.auto.css")}">
<!-- [script.js](https://github.com/ded/script.js) is a JavaScript loader
     and dependency manager. You should use this instead of <script> tags.
     TODO: consider https://addyosmani.com/basket.js/ as well -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/script.js/2.5.9/script.min.js"></script>
<script src="${layout.contentStrategy.assets.uScript("/typical.js")}"></script>
<script src="${layout.contentStrategy.assets.dsScript("/lightning.js")}"></script>

<!-- TODO: only include experimental-operational-ctx.mjs if running in a server -->
<script src="${layout.contentStrategy.assets.uScript("/experimental-operational-ctx.mjs")}" type="module"></script>

${dia.clientDiagramsContributionsPartial(layout)}
${ext.clientExtensionsContributionsPartial(layout)}
<script>
  // Discover, detect, and configure Resource Factory server-side layout knowledge
  // on the user agent (client) side. lightningDSLayout() is defined in lightning.js;
  // after it is initialized, it will call event "rfUniversalLayout.init"
  const ${layout.clientCargoPropertyName} = lightningDSLayout({ diagnose: true });
</script>
<link rel="shortcut icon" href="${layout.contentStrategy.assets.favIcon("/asset/image/favicon.ico")}"/>
<title>${layout.layoutText.title(layout)}</title>
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-MX2G8XW');</script>
<!-- End Google Tag Manager -->`;

// deno-fmt-ignore (because we don't want ${...} wrapped)
export const typicalTailPartial: ldsGovn.LightningPartial = (layout) => `
<script src="${layout.contentStrategy.assets.uScript("/typical-aft.js")}"></script>`;

// deno-fmt-ignore (because we don't want ${...} wrapped)
export const redirectConsoleContainerPartial: ldsGovn.LightningPartial = (layout) => layout.redirectConsoleToHTML ? `
<ul id="container_redirectConsole"></ul>` : `<!-- layout.redirectConsoleToHTML is false -->
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MX2G8XW"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;

// deno-fmt-ignore (because we don't want ${...} wrapped)
export const redirectConsolePartial: ldsGovn.LightningPartial = (layout) => layout.redirectConsoleToHTML ? `
<script>redirectConsoleToHTML()</script>` : `<!-- layout.redirectConsoleToHTML is false -->`;
