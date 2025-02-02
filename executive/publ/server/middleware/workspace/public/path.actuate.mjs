// User agent (client side) hydration is managed by Effector events, stores,
// and effects. Learn from Svelte components which extracts state from components
// into a hoisted scope and sort all expressions into Effector "business logic".
// Unless we're talking about simple, truly local, state stored in components,
// perform all state management outside of components as Effect "business logic"
// and allow components to observe those events and stores ("watched hydration").
//
// A good example of watched hydration is pageFetchJsonFx, which acts as a server-
// fetch "service bus" Effector effect. All functions that need server side JSON
// should use the pageFetchJsonFx directly or wrap pageFetchJsonFx into a custom
// effect. Then, any page content that needs hydration can use either a wrapped,
// or "composed", or direct call to pageFetchJsonFx. This means that all server
// fetches for arbitrary JSON can be observed and reacted upon by each component
// without needing any special hydration at the component level.
//
// Observability should be Effector-independent, too. This means that each effect
// such as pageFetchJsonFx should implement normal DOM-based events whenever
// possible so that *.addEventListener can be used for listening to hydration
// messages.
//
// Philosopy:
// * Don't re-invent or re-imagine HTML, even if it's extra code just use HTML.
// * Allow progressive rendering to stream content users as soon as it's ready.
//   Client side JavaScript bundles should be eliminated or async defered. Data
//   requests should never prevent rendering (load them after first paint). HTML,
//   assets, and images must be loaded as soon as possible with asynchronous
//   data loading in as it completes.

import { createDomain } from "https://unpkg.com/effector@22.2.0/effector.mjs";
import JSONFormatter from "https://cdn.jsdelivr.net/npm/json-formatter-js@2.3.4/dist/json-formatter.esm.js";
import * as sb from "./service-bus.mjs";

// We directly import Javascript but we need to "bundle" Typescript.
// deps.auto.js is auto-bundled from any Typescript we consider a dependency.
import * as d from "./deps.auto.js";
export * from "./deps.auto.js"; // make symbols available to pages

// public/operational-context/server.auto.mjs sets window.parent.inspectableClientLayout
// using executive/publ/server/middleware/workspace/public/inspect/index.html registerRfExplorerTarget
export const inspectableClientLayout = () => window.parent.inspectableClientLayout;
export const isClientLayoutInspectable = () => window.parent.inspectableClientLayout ? true : false;
export const isFramedExplorer = () => window.parent.isFramedExplorer && window.parent.isFramedExplorer() ? true : false;

// if a fetchURL looks like "x/y/test.ts.json" or "test.js.json" it's
// considered a server-side source (serverSideSrc) fetch URL, which runs JS/TS
// code on the server and returns JSON response as evaluated on the server.
export const isServerSideSrcFetchURL = (fetchURL) => fetchURL.match(/\.(js|ts)\.json$/);

/**
 * fetchFxInitServerSideSrc prepares sb.fetchFx params with requestInit and
 * fetchURL for fetching server-side source (serverSideSrc) JSON value.
 * @param {*} fetchURL the endpoint to call
 * @param {*} serverSideSrc text of JS or TS source code to send to the server
 * @returns partial sb.fetchFx params which for spreading with other params
 */
export function fetchFxInitServerSideSrc(fetchURL, serverSideSrc) {
    return {
        fetchURL,
        requestInit: (_fetchFxParams) => {
            return {
                method: "POST",
                body: serverSideSrc,
                headers: { "Content-Type": "text/plain" }
            };
        }
    }
}

let fetchFxInitSqlIndex = 0;
export const fetchSqlFxSuccessEventName = "fetchSqlFxSuccess";

/**
 * fetchFxInitSQL prepares sb.fetchFx params with requestInit and
 * fetchURL for fetching SQL execution results from any server-side endpoint.
 * @param {string} SQL the SQL text to send to the server
 * @param {string} rowNature "rows" for array of arrays, or "records" for array of objects with keys as column names
 * @param {string} fetchURL the endpoint to call, defaults to "/SQL"
 * @returns partial sb.fetchFx params which for spreading with other params
 */
export function fetchFxInitSQL(SQL, fetchFxSqlID, rowNature = "records", fetchURL = "/SQL") {
    fetchFxInitSqlIndex++;
    return {
        fetchFxSqlID: fetchFxSqlID && fetchFxSqlID.toString().trim().length > 0
            ? fetchFxSqlID
            : `fetchFxInitSQL_${fetchFxInitSqlIndex}`,
        fetchURL,
        requestInit: () => ({
            method: "POST",
            headers: {
                'Content-type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ SQL, rowNature })
        }),
        fetchFxSuccessEventName: fetchSqlFxSuccessEventName
    }
}

/**
 * fetchFxInitPublSqlDQL prepares sb.fetchFx params with requestInit and
 * fetchURL for fetching SQL execution results from server-side SQLite instance.
 * @param {string} SQL the SQL text to send to the server
 * @param {string} rowNature "rows" for array of arrays, or "records" for array of objects with keys as column names
 * @returns partial sb.fetchFx params which for spreading with other params
 */
export function fetchFxInitPublSqlDQL(SQL, fetchFxSqlID, rowNature) {
    return fetchFxInitSQL(SQL, fetchFxSqlID, rowNature, "/SQL/publ/DQL");
}

/**
 * fetchFxInitAlaSqlProxyDQL prepares sb.fetchFx params with requestInit and
 * fetchURL for fetching SQL execution results from server-side AlaSqlProxy instance.
 * @param {string} SQL the SQL text to send to the server
 * @param {string} rowNature "rows" for array of arrays, or "records" for array of objects with keys as column names
 * @returns partial sb.fetchFx params which for spreading with other params
 */
export function fetchFxInitAlaSqlProxyDQL(SQL, fetchFxSqlID, rowNature) {
    return fetchFxInitSQL(SQL, fetchFxSqlID, rowNature, "/SQL/asp");
}

// prepare effects, events and stores that can be used for site management;
// at a minimum, every page in the site should have this default Javascript:
//   document.addEventListener('DOMContentLoaded', () => activatePage(inspectableClientLayout()));
// assume that activatePage will be call after all content is loaded and that
// the "inspectable clientLayout" is available.
export const siteDomain = createDomain("project");
export const activatePage = siteDomain.createEvent();

// content effect (CFX) block (CFXB) events; CFXB events are guaranteed to be
// called after all DOM content has been loaded. Each event has clientLayout
// passed in as a parameter (in addition to event-specific parameters).
export const cfxbFetchSqlJsonDomElemDetected = siteDomain.createEvent();
export const cfxbFetchSqlJsonFxPrepared = siteDomain.createEvent();

/**
 * pageAutoEffects are "registered" Effector effects that will be auto-executed
 * by the activatePage event (mainly for convenience and literate programming
 * documentation).
 */
const pageAutoEffects = [];

export const pageAutoEffect = (effect, params) => {
    pageAutoEffects.push({ effect, params, isApplied: false });
    return effect;
}

export const pageAutoFetchSqlEffect = (fetchFxSqlID, SQL) => {
    return pageAutoEffect(siteDomain.createEffect(async (params) => await pageFetchJsonFx({
        ...fetchFxInitSQL(SQL, fetchFxSqlID),
        ...params,
    })));
}

window.addEventListener(sb.fetchFxFailEventName, (event) => {
    console.error(sb.fetchFxFailEventName, { event });
});

// Whenever a basic JSON fetch is required, use this so others can listen in
// and react to effects in case they need it. Don't use custom fetches because
// those cannot be easily observed by others. This is the central JSON-focused
// "fetch service bus". The only required effect parameter is "fetchURL" but
// other parameters such as "fetchID" or "fetchCtx" could be used as well.
// You can pass in diagnose to add some diagnostics or pass in cache: false
// if a caching is not desired (don't use cache: undefined, use cache: false).
export const pageFetchJsonFx = siteDomain.createEffect(async (params) => await sb.fetchFx({
    ...params, fetchValue: sb.fetchRespJsonValue
}));

// Since deps.js.ts contains "https://raw.githubusercontent.com/douglascrockford/JSON-js/master/cycle.js",
// pageFetchJsonFx also supports JSON.decycle and JSON.retrocycle to allow complex
// JSON values which might have circular values. By default retrocyle is TRUE.
export const pageFetchRetrocycledJsonJFx = siteDomain.createEffect(async (params) => await sb.fetchFx({
    ...params, fetchValue: sb.fetchRespRetrocycledJsonValue
}));

export const transformContentFx = siteDomain.createEffect(async () => {
    // find all <pre data-transformable="markdown"> and run Markdown-it transformation
    await d.transformMarkdownElems();
});

export const jsEvalFailureHTML = (evaluatedJS, error, location, context) => {
    console.error(`Unable to evaluate ${evaluatedJS} in ${location}`, error, context);
    return `Unable to evaluate <code><mark>${evaluatedJS}</mark></code>: <code><mark style="background-color:#FFF2F2">${error}</mark></code> in <code>${location}</code>`;
}

// find any fetchable JSON placeholders and fill them in
activatePage.watch((clientLayout) => {
    const populateJSON = (elem, result, evalExpr, scope) => {
        if (evalExpr) {
            // if given an eval'able expression, get the expression value
            // in this context and populate that JSON instead of full JSON
            try {
                populateObjectJSON(eval(evalExpr), elem);
            } catch (error) {
                elem.innerHTML = jsEvalFailureHTML(evalExpr, error, 'activatePage.watch.populateJSON(${scope})', { clientLayout });
            }
        } else {
            // Not given an eval'able expression, populate full JSON
            populateObjectJSON(result, elem);
        }
    }

    // prepare event listeners for fetched URLs (client-side hydration);
    // all page-auto-effects and sb.fetchFx calls will generate events.
    for (const elem of document.querySelectorAll(`[data-populate-fetched-json-url]`)) {
        // usage example:
        //   <div data-populate-fetched-json-url="/workspace/inspect/env-vars.json"></div>
        //   <div data-populate-fetched-json-url="/workspace/inspect/env-vars.json" data-populate-fetched-json-expr="result.something"></div>
        const fetchURL = elem.dataset.populateFetchedJsonUrl;
        window.addEventListener(sb.fetchFxSuccessEventName, (event) => {
            const { fetchedValue: result, fetchFxCtx } = (event.detail ? event.detail : {});
            if (fetchFxCtx.params.fetchURL) {
                if (fetchFxCtx.params.fetchURL === fetchURL) {
                    populateJSON(elem, result, elem.dataset.populateFetchedJsonExpr, "data-populate-fetched-json-url");
                }
            } else {
                console.error(`activatePage.watch() => window.addEventListener(${sb.fetchFxSuccessEventName}) has no fetchURL`, event);
            }
        });
        if (!isServerSideSrcFetchURL(fetchURL)) {
            // if a fetch is not server side source code, execute it now;
            // due to caching, pageFetchJsonFx (which uses sb.fetchFx) is
            // idempotent and can be safely called multiple times.
            pageFetchJsonFx({ fetchURL });
        }
    }

    // assumes that the identifiable SQL effect is defined separately
    for (const elem of document.querySelectorAll(`[data-populate-fetched-SQL-ID]`)) {
        // usage example:
        //   <div data-populate-fetched-SQL-ID="my_sql_id"></div>
        //   <div data-populate-fetched-SQL-ID="my_sql_id" data-populate-fetched-json-expr="result.something"></div>
        const fetchFxSqlID = elem.dataset.populateFetchedSqlId;
        window.addEventListener(fetchSqlFxSuccessEventName, (event) => {
            const { fetchedValue: result, fetchFxCtx } = (event.detail ? event.detail : {});
            if (fetchFxCtx.params.fetchFxSqlID) {
                if (fetchFxCtx.params.fetchFxSqlID == fetchFxSqlID) {
                    populateJSON(elem, result, elem.dataset.populateFetchedJsonExpr, "data-populate-fetched-SQL-ID");
                }
            } else {
                console.error(`activatePage.watch() => window.addEventListener(${fetchSqlFxSuccessEventName}) has no fetchFxSqlID`, event);
            }
        });
    }

    // assumes that the SQL is embedded as an attribute
    for (const elem of document.querySelectorAll(`[data-populate-fetched-SQL]`)) {
        // usage example:
        //   <div data-populate-fetched-SQL="SELECT * FROM something"></div>
        //   <div data-populate-fetched-SQL="SELECT * FROM something" data-populate-fetched-json-expr="result.something"></div>
        const fetchFxSql = elem.dataset.populateFetchedSql;
        const fetchFxSqlID = fetchFxSql; // identity is same as SQL
        window.addEventListener(fetchSqlFxSuccessEventName, (event) => {
            const { fetchedValue: result, fetchFxCtx } = (event.detail ? event.detail : {});
            if (fetchFxCtx.params.fetchFxSqlID) {
                if (fetchFxCtx.params.fetchFxSqlID == fetchFxSqlID) {
                    populateJSON(elem, result, elem.dataset.populateFetchedJsonExpr, "data-populate-fetched-SQL");
                }
            } else {
                console.error(`activatePage.watch() => window.addEventListener(${fetchSqlFxSuccessEventName}) has no fetchFxSqlID`, event);
            }
        });
        // schedule the fetch now, it will be executed down below
        pageAutoFetchSqlEffect(fetchFxSqlID, fetchFxSql);
    }

    for (const elem of document.querySelectorAll(`[data-populate-activate-page-watch-json]`)) {
        // usage examples:
        //   <div data-populate-activate-page-watch-json="clientLayout.route"></div>
        //   <div data-populate-activate-page-watch-json="clientLayout.route.terminal"></div>
        const evalExpr = elem.dataset.populateActivatePageWatchJson;
        try {
            const result = eval(evalExpr);
            if (result) {
                populateObjectJSON(result, elem);
            } else {
                elem.innerHTML = `Unable to evaluate <code><mark>${evalExpr}</mark></code>: produced undefined result`;
            }
        } catch (error) {
            elem.innerHTML = jsEvalFailureHTML(evalExpr, error, 'activatePage.watch(data-populate-activate-page-watch-json)', { clientLayout });
        }
    }

    // apply all auto-effects and see if they resolve any dependencies
    for (const autoEffect of pageAutoEffects) {
        const { effect, params } = autoEffect;
        effect(params);
        autoEffect.isApplied = true;
    }
});

cfxbFetchSqlJsonDomElemDetected.watch((cfxbSqlDomElemDetectedParams) => {
    const { clientLayout, cfxbDomElem, SQL, fetchSqlJsonFxInit, jsEvalFailureHTML, sqlScriptElem } = cfxbSqlDomElemDetectedParams;

    const fetchSqlJsonFx = siteDomain.createEffect(async (params) => await pageFetchJsonFx({
        ...fetchSqlJsonFxInit,
        ...params,
    }));
    const watchScriptElem = cfxbDomElem.querySelector('script[type="onSqlResult"]');
    const watchScriptAttr = sqlScriptElem?.getAttribute('onSqlResult') ?? cfxbDomElem.getAttribute('onSqlResult');
    const diagnose = watchScriptElem?.hasAttribute("diagnose") ?? (sqlScriptElem?.getAttribute('diagnose') ?? cfxbDomElem.getAttribute('diagnose'));
    const onSqlResultExpr = watchScriptElem ? watchScriptElem.innerText : watchScriptAttr;
    fetchSqlJsonFx.done.watch(({ result }) => {
        if (watchScriptElem || watchScriptAttr) {
            const diagnostics = () => ({
                result, onSqlResultExpr, cfxbSqlDomElemDetectedParams, SQL, fetchSqlJsonFx, fetchSqlJsonFxInit, clientLayout, watchScriptElem, watchScriptAttr
            });
            if (diagnose) console.log('onSqlResult', diagnostics());
            try {
                // tokens `result`, `SQL`, `clientLayout`, etc. will all be in scope
                // add the `self` alias for convenience so that content producers can
                // use self.innerHTML = 'X' instead of cfxbDomElem (in case we have
                // to rename that variable in the future)
                // deno-lint-ignore no-unused-vars
                const self = cfxbDomElem;
                eval(onSqlResultExpr);
            } catch (error) {
                cfxbDomElem.innerHTML = jsEvalFailureHTML({
                    evaluatedJS: onSqlResultExpr, error,
                    location: 'cfxbFetchSqlJsonDomElemDetected.watch(SQL-result-eval)',
                    context: diagnostics()
                });
            }
        } else {
            populateObjectJSON(result, cfxbDomElem);
        }
    });

    // announce we're about to execute a SQL effect, let others hook in to the
    // fetchSqlJsonFx if they also need to handle the SQL result; the cfxbFetchSqlJsonFxPrepared
    // event receives all parameters of this event plus a few extras
    cfxbFetchSqlJsonFxPrepared({
        ...cfxbSqlDomElemDetectedParams,
        fetchSqlJsonFxID: fetchSqlJsonFxInit.fetchFxSqlID, // hoist the identity for convenience
        fetchSqlJsonFx,
        onSqlResultExpr,
        watchScriptElem,
        diagnose
    });

    // we're all wired up (including new hooks introduced through cfxbFetchSqlJsonFxPrepared
    // observers), execute the SQL effect now and trigger all the watchers
    fetchSqlJsonFx();
});

// execute content effect (CFX) blocks (CFXBs)
activatePage.watch((clientLayout) => {
    const jsEvalFailureHTML = ({ evaluatedJS, error, location, context }) => {
        console.error(`Unable to evaluate ${evaluatedJS} in ${location}`, error, context);
        return `Unable to evaluate <code><mark>${evaluatedJS}</mark></code>: <code><mark style="background-color:#FFF2F2">${error}</mark></code> in <code>${location}</code>`;
    }

    // any element which has a SQL attribute is considered a content effect
    for (const cfxbDomElem of document.querySelectorAll(`[SQL]`)) {
        const SQL = cfxbDomElem.getAttribute("SQL");
        const fetchFxSqlID = cfxbDomElem.id;
        const fetchSqlJsonFxInit = fetchFxInitAlaSqlProxyDQL(SQL, fetchFxSqlID);
        // trigger anyone watching cfxbFetchSqlJsonDomElemDetected event
        cfxbFetchSqlJsonDomElemDetected({
            clientLayout, cfxbDomElem, SQL, fetchSqlJsonFxInit, jsEvalFailureHTML
        });
    }

    // any element which has a <script type="SQL"> element is considered a content effect
    for (const sqlScriptElem of document.querySelectorAll('script[type="SQL"]')) {
        const cfxbDomElem = sqlScriptElem.parentNode;
        const SQL = sqlScriptElem.innerHTML.trim();
        const fetchFxSqlID = sqlScriptElem.id ?? cfxbDomElem.id;
        const fetchSqlJsonFxInit = fetchFxInitAlaSqlProxyDQL(SQL, fetchFxSqlID);
        // trigger anyone watching cfxbFetchSqlJsonDomElemDetected event
        cfxbFetchSqlJsonDomElemDetected({
            clientLayout, cfxbDomElem, SQL, fetchSqlJsonFxInit, sqlScriptElem, jsEvalFailureHTML
        });
    }
});

/**
 * Given a Resource Factory route-like instance, derive parts that could be used
 * to prepare an anchor, button or link that would lead to the editable resource
 * in IDEs like VS Code.
 * @param {rfGovn.Route} route RF route-like instance
 * @returns {{ src: string, href: string, narrative: string}} parts that could be used in anchors
 */
export const editableRouteAnchor = (route, onNotEditable) => {
    const activeResourceAbsPath = route?.terminal?.fileSysPath;
    if (activeResourceAbsPath) {
        const [redirectURL, src] = d.editableFileRedirectURL(activeResourceAbsPath);
        return {
            src,
            href: redirectURL,
            narrative: `Edit ${route?.terminal?.fileSysPathParts?.base} in IDE`,
        };
    } else if (route?.origin) {
        const { origin } = route;
        const [href, src] = d.locationEditorRedirectURL(origin);
        let fileName = src;
        const lastSlash = src ? src.lastIndexOf('/') : -1;
        if (lastSlash > 0) fileName = src.substring(lastSlash + 1);
        return {
            src,
            href,
            narrative: `Edit ${fileName} in IDE${origin.label ? ` (look for ${origin.label})` : ''}`,
        };
    }
    return onNotEditable ? onNotEditable(route) : undefined;
}

export const editableClientLayoutTarget = (clientLayout = inspectableClientLayout(), onNotEditable) => {
    return editableRouteAnchor(clientLayout.route, onNotEditable);
}

export const activateFooter = () => {
    const footer = document.createElement("footer");
    footer.className = "page";

    if (isFramedExplorer()) {
        footer.appendChild(document.createTextNode("🧭"));

        const selected = (which) => window.parent.location.search.indexOf(`orientation=${which}`) > 0 ? " selected" : "";
        const orientationSelect = document.createElement("select");
        orientationSelect.className = "orientation";
        orientationSelect.innerHTML = `
            <option value="?orientation=east&size=25"${selected('east')}>East</option>
            <option value="?orientation=south&size=35"${selected('south')}>South</option>
            <option value="?orientation=west&size=25"${selected('west')}>West</option>
            <option value="?orientation=north&size=35"${selected('north')}>North</option>`;
        orientationSelect.onchange = (event) => window.parent.location.search = event.target.value;
        orientationSelect.title = "Change rfExplorer Panel Orientation";
        footer.appendChild(orientationSelect);

        if (isClientLayoutInspectable()) {
            const clientLayout = inspectableClientLayout();
            const closeAnchor = document.createElement("a");
            closeAnchor.className = "info action-close-explorer";
            closeAnchor.href = clientLayout.navigation.location(clientLayout.route?.terminal);
            closeAnchor.target = "_top";
            closeAnchor.innerHTML = "❎ Close";
            closeAnchor.title = "Close rfExplorer Panel";
            footer.appendChild(closeAnchor);
        }
    }

    const restartAnchor = document.createElement("a");
    restartAnchor.className = "info action-restart-publ-server";
    restartAnchor.onclick = () => fetch('/server/restart');
    restartAnchor.innerHTML = "↻ Restart";
    restartAnchor.title = "Restart pubctl.ts server";
    footer.appendChild(restartAnchor);

    const todoAnchor = document.createElement("a");
    todoAnchor.className = "info action-TODO";
    todoAnchor.href = '/workspace/docs/';
    todoAnchor.innerHTML = "TODOs";
    footer.appendChild(todoAnchor);

    const editWsPageAnchor = document.createElement("a");
    let wsPageLogicalFsPath = window.location.pathname.replace("/workspace", "/public");
    if (wsPageLogicalFsPath.endsWith("/")) wsPageLogicalFsPath += "index.html";
    const wsPageFactoryPath = `/factory/executive/publ/server/middleware/workspace${wsPageLogicalFsPath}`;
    editWsPageAnchor.className = "info action-edit-workspace-src";
    editWsPageAnchor.href = `/workspace/editor-redirect${wsPageFactoryPath}`;
    editWsPageAnchor.innerHTML = "📝 Src";
    editWsPageAnchor.title = `Edit ${wsPageFactoryPath}`;
    footer.appendChild(editWsPageAnchor);

    document.body.appendChild(footer);
}

/**
 * Activate all site-wide functionality such as navigation. We use as much
 * modern HTML5, "vanilla" HTML, and as little JS as possible. When JS is needed
 * use Effector for state management and async effect.
 * UI guide: https://www.w3schools.com/howto/
 */
export const activateSite = () => {
    // TODO: consider using https://www.w3schools.com/howto/howto_html_include.asp
    const baseURL = "/workspace";
    const navPrime = document.createElement("nav");
    navPrime.className = "prime";
    // <!-- --> are there in between <a> tags to allow easier readability here but render with no spacing in DOM
    navPrime.innerHTML = `
           <a href="#" class="highlight"><i class="fa-solid fa-file-code"></i> Edit</a><!--
        --><a href="${baseURL}/inspect/routes.html"><i class="fa-solid fa-route"></i> Routes</a><!--
        --><a href="${baseURL}/inspect/layout.html"><i class="fa-solid fa-layer-group"></i> Layout</a><!--
        --><a href="${baseURL}/db/index.html"><i class="fa-solid fa-database"></i> psDB</a><!--
        --><a href="${baseURL}/inspect/operational-ctx.html"><i class="fa-solid fa-terminal"></i> OpCtx</a><!--
        --><a href="${baseURL}/assurance/"><i class="fa-solid fa-microscope"></i> Unit Tests</a>`;
    document.body.insertBefore(navPrime, document.body.firstChild);

    const editAnchor = navPrime.querySelector("a"); // the first anchor is the Edit button
    if (isClientLayoutInspectable()) {
        const eclTarget = editableClientLayoutTarget(
            inspectableClientLayout(), (route) => ({
                href: "#", narrative: `route not editable: ${JSON.stringify(route)}`
            }));
        editAnchor.href = eclTarget.href;
        editAnchor.title = eclTarget.narrative;
    } else {
        editAnchor.style.display = "none";
    }

    for (const a of navPrime.children) {
        if (a.href == window.location) {
            a.className += " active";
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        activateFooter();
    });
}

export const populateObjectJSON = (inspect, targetElem, open, options) => {
    if (targetElem) {
        targetElem.innerHTML = "";
        // see https://github.com/mohsen1/json-formatter-js#api
        const formatter = new JSONFormatter(inspect, open, options);
        targetElem.appendChild(formatter.render());
    }
}
