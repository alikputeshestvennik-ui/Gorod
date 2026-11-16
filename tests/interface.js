'use strict';
function check(ok,message){if(!ok)throw Error(message);}
check(nodes.modal.open,'Intro must be visible');
buttonClick({action:'start'});check(!nodes.modal.open,'Intro must close');
nextFrame(1);nextFrame(1001);check(drawCount>500,'Canvas should draw the city');
nodes['new-route'].onclick();check(!nodes['build-bar'].hidden,'Build controls visible');
var u=Math.min(800/25,580/16.5);
function tapStop(x,y){var cx=400+(x-y)*u,cy=580*.49+(x+y-11)*u*.5-.05*u;
 callbacks['city:pointerdown']({pointerId:1,clientX:cx,clientY:cy});callbacks['city:pointerup']({pointerId:1,clientX:cx,clientY:cy});}
tapStop(4,7);tapStop(7,4);check(!nodes['confirm-route'].disabled,'Two stops enable opening');
nodes['confirm-route'].onclick();check(nodes['build-bar'].hidden,'Route opens and exits build mode');
var persisted=JSON.parse(saved['city-route-save-v1']);check(persisted.routes.length===2,'Opened route persisted');check(persisted.mission===1,'Hospital mission completed through UI');
navs[1].onclick();check(nodes['modal-content'].innerHTML.includes('Ваш автопарк'),'Fleet opens');
buttonClick({action:'buy'});check(JSON.parse(saved['city-route-save-v1']).vehicles.length===3,'Purchase from fleet works');
buttonClick({action:'close'});navs[2].onclick();check(nodes['modal-content'].innerHTML.includes('Стоимость проезда'),'Finance opens');
buttonClick({fare:'5'});check(JSON.parse(saved['city-route-save-v1']).fare===40,'Fare persisted');
buttonClick({action:'close'});navs[3].onclick();check(nodes['modal-content'].innerHTML.includes('История города'),'Journal opens');
buttonClick({action:'close'});nodes.layers.onclick();nodes['zoom-in'].onclick();nodes.pause.onclick();nextFrame(2001);nodes.pause.onclick();
nodes.settings.onclick();buttonClick({action:'restart'});check(JSON.parse(saved['city-route-save-v1']).routes.length===1,'Restart creates fresh state');
callbacks['city:pointerdown']({pointerId:4,clientX:150,clientY:150});callbacks['city:pointercancel']({pointerId:4,clientX:150,clientY:150});nextFrame(3001);
check(frames.length===1,'A single animation loop remains scheduled');
console.log('ALL INTERFACE TESTS PASSED (canvas, routing, fleet, finance, journal, restart, touch cancellation)');
