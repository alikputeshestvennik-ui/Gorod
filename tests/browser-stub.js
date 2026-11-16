// Minimal browser contract; this is not a layout or device test.
var window=globalThis, callbacks={}, nodes={}, saved={}, frames=[], documentEvents={};
window.devicePixelRatio=1;
window.addEventListener=function(){};
window.location={protocol:'file:'};
if(typeof navigator==='undefined')window.navigator={};
window.setTimeout=function(){return 1;};window.clearTimeout=function(){};
window.requestAnimationFrame=function(fn){frames.push(fn);};
window.localStorage={getItem:function(k){return saved[k]||null;},setItem:function(k,v){saved[k]=v;}};
var gradient={addColorStop:function(){}};
var drawCount=0;
var context=new Proxy({}, {get:function(target,key){
  if(key==='createRadialGradient')return function(){return gradient;};
  if(key==='measureText')return function(t){return {width:t.length*5};};
  return function(){drawCount++;};
},set:function(){return true;}});
function element(id){
  if(nodes[id])return nodes[id];
  var n={id:id,style:{},dataset:{},hidden:false,open:false,innerHTML:'',textContent:'',isConnected:true,tagName:'DIV',
    classList:{add:function(){},remove:function(){},toggle:function(){}},
    setAttribute:function(){},focus:function(){},getBoundingClientRect:function(){return {x:0,y:0,left:0,top:0,width:800,height:580,right:800,bottom:580};},
    getContext:function(){return context;},setPointerCapture:function(){},
    addEventListener:function(name,fn){callbacks[id+':'+name]=fn;},
    showModal:function(){this.open=true;},close:function(){this.open=false;if(callbacks[id+':close'])callbacks[id+':close']();}};
  nodes[id]=n;return n;
}
var navs=['map','fleet','finance','journal'].map(function(p){var n=element('nav-'+p);n.dataset.panel=p;return n;});
var speeds=[1,2,4].map(function(s){var n=element('speed-'+s);n.dataset.speed=String(s);return n;});
window.document={hidden:false,activeElement:element('focus'),getElementById:element,
  querySelector:function(sel){return element(sel);},
  querySelectorAll:function(sel){if(sel==='[data-panel]'||sel==='.nav')return navs;if(sel==='[data-speed]')return speeds;return [];},
  addEventListener:function(name,fn){documentEvents[name]=fn;}};
window.ResizeObserver=function(fn){this.observe=function(){fn();};};
function buttonClick(data){var b={dataset:data};documentEvents.click({target:{closest:function(){return b;}}});}
function nextFrame(t){var f=frames.shift();if(!f)throw Error('No animation scheduled');f(t);}
