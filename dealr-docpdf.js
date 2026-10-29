/* Dealr – PDF d'un devis ou d'une facture (partagé par la page Devis et factures et la messagerie)
   DealrDocPDF(doc) renvoie un document DealrPDF : .save(nom), .blob() */
(function(){
var eur=function(n){return new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(n||0)};
var r2=function(n){return Math.round(n*100)/100};
function fr(s,add){var d=new Date(s+"T12:00:00");d.setDate(d.getDate()+(add||0));return d.toLocaleDateString("fr-FR")}
function legalId(id){id=String(id||"").replace(/\D/g,"");return id.length===14?"SIRET : "+id:(id?"SIREN : "+id:"")}
window.DealrDocPDF=function(doc){
function calc(){
  var sub=r2(doc.lines.reduce(function(a,l){return a+(+l.q||0)*(+l.pu||0)},0)),rem=r2(sub*(doc.rem||0)/100),ht=r2(sub-rem),tva=r2(ht*(doc.tva||0)/100),ttc=r2(ht+tva),acc=r2(ttc*(doc.acc||0)/100);
  return{sub:sub,rem:rem,ht:ht,tva:tva,ttc:ttc,acc:acc,net:r2(ttc-acc)}}
function buildPdf(){
  var dev=doc.type==="devis",t=calc(),iss=doc.issuer,cl=doc.client;
  var P=DealrPDF.create({title:(dev?"Devis ":"Facture ")+doc.num}),W=P.W,H=P.H;
  var L=48,Rx=W-48,CW=Rx-L,y=58,INK="#111111",MUTE="#6b6b73",LINE="#dcdce2",OR="#f55a1f";
  var due=doc.pay?fr(doc.date,+doc.pay):"à réception";
  function need(h){if(y+h>H-64){P.addPage();y=58}}
  /* En-tête */
  P.circle(L+5,y-4,5,OR);P.text(L+15,y,"Dealr",{size:11,bold:true});
  y+=36;P.text(L,y,dev?"DEVIS":"FACTURE",{size:28,bold:true});
  P.text(Rx,y-15,"Date : "+fr(doc.date),{align:"right",size:10});
  P.text(Rx,y,dev?"Valable jusqu’au "+fr(doc.date,+doc.valid||30):"Échéance : "+due,{align:"right",size:10});
  y+=17;P.text(L,y,"N° "+doc.num,{size:11,color:MUTE});
  y+=12;P.line(L,y,Rx,y,2.5,INK);
  /* Émetteur et client */
  y+=26;var top=y,half=CW/2-12;
  function party(x,label,p,extra){var yy=top;P.text(x,yy,label,{size:8,bold:true,color:MUTE});yy+=16;
    P.wrap(p.name||"—",half,11,true).forEach(function(l){P.text(x,yy,l,{size:11,bold:true});yy+=14});
    P.wrap(p.addr||"",half,10,false).forEach(function(l){if(l){P.text(x,yy,l,{size:10});yy+=13}});
    extra.forEach(function(e){if(e){P.wrap(e,half,10,false).forEach(function(l){P.text(x,yy,l,{size:10});yy+=13})}});return yy}
  y=Math.max(party(L,"ÉMETTEUR",iss,[legalId(iss.siret),iss.tva?"N° TVA : "+iss.tva:"",iss.email]),party(L+CW/2+12,"CLIENT",cl,[cl.email]))+18;
  /* Tableau des prestations */
  var cQ=L+305,cP=L+395;
  function head(){P.text(L,y,"DÉSIGNATION",{size:8,bold:true,color:MUTE});P.text(cQ,y,"QUANTITÉ",{size:8,bold:true,color:MUTE,align:"right"});
    P.text(cP,y,"PU HT",{size:8,bold:true,color:MUTE,align:"right"});P.text(Rx,y,"TOTAL HT",{size:8,bold:true,color:MUTE,align:"right"});y+=7;P.line(L,y,Rx,y,1,INK);y+=16}
  head();
  doc.lines.forEach(function(l){var lines=P.wrap(l.d||"—",235,10,false),hh=lines.length*13+10;
    if(y+hh>H-64){P.addPage();y=58;head()}
    P.text(cQ,y,String(l.q)+" "+String(l.u||""),{size:10,align:"right"});P.text(cP,y,eur(l.pu),{size:10,align:"right"});
    P.text(Rx,y,eur((+l.q||0)*(+l.pu||0)),{size:10,align:"right"});
    lines.forEach(function(s,i){P.text(L,y+i*13,s,{size:10})});y+=lines.length*13-3;P.line(L,y,Rx,y,.6,LINE);y+=16});
  /* Totaux */
  var rows=[["Sous-total HT",eur(t.sub)]];if(t.rem)rows.push(["Remise ("+doc.rem+" %)","−"+eur(t.rem)]);
  rows.push(["Total HT",eur(t.ht)],["TVA ("+String(doc.tva).replace(".",",")+" %)",eur(t.tva)]);
  need(rows.length*15+80);var tx=Rx-235;y+=4;
  rows.forEach(function(r){P.text(tx,y,r[0],{size:10});P.text(Rx,y,r[1],{size:10,align:"right"});y+=15});
  y-=4;P.line(tx,y,Rx,y,1.5,INK);y+=18;P.text(tx,y,"Total TTC",{size:13,bold:true});P.text(Rx,y,eur(t.ttc),{size:13,bold:true,align:"right"});y+=16;
  if(t.acc){P.text(tx,y,(dev?"Acompte à la commande":"Acompte déjà réglé")+" ("+doc.acc+" %)",{size:10});P.text(Rx,y,eur(t.acc),{size:10,align:"right"});y+=15;
    if(!dev){P.text(tx,y,"Reste à payer",{size:12,bold:true});P.text(Rx,y,eur(t.net),{size:12,bold:true,align:"right"});y+=15}}
  /* Notes */
  if(doc.notes){y+=12;P.wrap(doc.notes,CW,10,false).forEach(function(l){need(14);P.text(L,y,l,{size:10});y+=13})}
  /* Mentions */
  var mentions=dev
   ?"Devis valable jusqu’au "+fr(doc.date,+doc.valid||30)+". Paiement : "+(doc.pay?"sous "+doc.pay+" jours à compter de la facture":"à réception de la facture")+"."
   :"Date d’échéance : "+due+". En cas de retard de paiement, des pénalités calculées sur la base de trois fois le taux d’intérêt légal sont exigibles, ainsi qu’une indemnité forfaitaire de 40 € pour frais de recouvrement (clients professionnels). Pas d’escompte pour paiement anticipé.";
  if(!+doc.tva)mentions+=" TVA non applicable, art. 293 B du CGI.";
  y+=20;P.wrap(mentions,CW,8,false).forEach(function(l){need(12);P.text(L,y,l,{size:8,color:MUTE});y+=11});
  if(iss.iban){need(12);P.text(L,y,"Règlement par virement – IBAN : "+iss.iban,{size:8,color:MUTE});y+=11}
  /* Signature du client (devis) */
  if(dev){need(100);y+=16;P.rect(L,y,260,80,{stroke:"#9a9aa2",dash:true});P.text(L+12,y+18,"Bon pour accord, date et signature du client :",{size:9,color:MUTE})}
  /* Pied de page */
  var nb=P.pages.length;P.pages.forEach(function(pg,i){P.cur=pg;P.line(L,H-44,Rx,H-44,.6,LINE);
    P.text(L,H-30,(dev?"Devis ":"Facture ")+doc.num+(iss.name?" · "+iss.name:""),{size:8,color:MUTE});
    P.text(Rx,H-30,"Page "+(i+1)+" / "+nb,{size:8,color:MUTE,align:"right"})});
  return P}
return buildPdf()};
window.DealrDocPDF.total=function(doc){var r=r2,sub=r(doc.lines.reduce(function(a,l){return a+(+l.q||0)*(+l.pu||0)},0)),rem=r(sub*(doc.rem||0)/100),ht=r(sub-rem);return r(ht+r(ht*(doc.tva||0)/100))};
})();
