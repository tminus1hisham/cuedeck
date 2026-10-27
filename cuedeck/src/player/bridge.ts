/**
 * Injected at the top of every uploaded HTML deck. It runs inside a sandboxed iframe with an
 * opaque origin, so the only way in or out is postMessage. It drives the deck through whatever
 * API it finds (DAMA's <deck-stage>, reveal.js) and falls back to arrow-key events.
 * Listeners sit on window so they survive decks that replace their own document while unpacking.
 */
const BRIDGE = `(function(){
var last='';
function slidesOf(d){return [].filter.call(d.children,function(e){return !/^(TEMPLATE|SCRIPT|STYLE)$/.test(e.tagName)})}
function info(){
  var d=document.querySelector('deck-stage');
  if(d&&typeof d.index==='number'){var s=slidesOf(d);return {index:d.index,count:s.length,labels:s.map(function(e){return e.dataset.label||''})}}
  var R=window.Reveal;
  if(R&&R.getTotalSlides){return {index:R.getSlidePastCount(),count:R.getTotalSlides(),labels:[]}}
  var all=[].slice.call(document.querySelectorAll('[data-label]'));
  if(all.length>1){var i=all.findIndex(function(e){return e.hasAttribute('data-deck-active')||e.classList.contains('active')||e.classList.contains('present')});
    if(i>=0)return {index:i,count:all.length,labels:all.map(function(e){return e.dataset.label})}}
  return null}
function send(){var x=info(),j=JSON.stringify(x);if(j!==last){last=j;parent.postMessage({cuedeck:'inner',inner:x},'*')}}
function key(k){var t=document.activeElement||document.body;t.dispatchEvent(new KeyboardEvent('keydown',{key:k,code:k,bubbles:true}))}
addEventListener('message',function(e){var m=e.data;if(!m||!m.cuedeck||e.source!==parent)return;
  var d=document.querySelector('deck-stage'),R=window.Reveal,x=info();
  if(m.cuedeck==='next'){if(d&&d.next)d.next();else if(R&&R.next)R.next();else key('ArrowRight')}
  else if(m.cuedeck==='prev'){if(d&&d.prev)d.prev();else if(R&&R.prev)R.prev();else key('ArrowLeft')}
  else if(m.cuedeck==='last'&&x){if(d&&d.goTo)d.goTo(x.count-1);else if(R&&R.slide)R.slide(Infinity)}
  else if(m.cuedeck==='hello'){last=''}
  setTimeout(send,60)});
setInterval(send,500);
})();`;

/** Put the bridge before any of the deck's own scripts. */
export function withBridge(html: string): string {
  const tag = `<script>${BRIDGE}</script>`;
  const head = html.match(/<head[^>]*>/i);
  if (head) return html.replace(head[0], head[0] + tag);
  return tag + html;
}
