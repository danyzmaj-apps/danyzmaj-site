'use strict';
const cats=JSON.parse(document.getElementById('catalog').textContent);
const themes=JSON.parse(document.getElementById('theme-data').textContent);
const catButtons=[...document.querySelectorAll('.cat')];
const catSelect=document.getElementById('cat-select');
const darkMode=document.getElementById('dark-mode');
const preview=document.getElementById('preview');
const face=document.getElementById('face-art');
const error=document.getElementById('preview-error');
let selectedCat=0,selectedTheme=0,revision=0;
async function update(){
  const request=++revision,cat=cats[selectedCat],theme=themes[selectedTheme];
  catSelect.value=String(selectedCat);
  catButtons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===selectedCat)));
  document.querySelectorAll('.theme').forEach(button=>{
    const family=Number(button.dataset.family);
    button.setAttribute('aria-pressed',String(family===Math.floor(selectedTheme/2)));
    button.style.setProperty('--swatch',themes[family*2+(theme.dark?1:0)].colors[4]);
  });
  document.querySelectorAll('.world-pick').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.theme)===selectedTheme)));
  darkMode.setAttribute('aria-pressed',String(theme.dark));
  darkMode.setAttribute('aria-label',theme.dark?'Switch to daytime':'Switch to lamplight');
  document.getElementById('mode-label').textContent=theme.dark?'Daytime':'Lamplight';
  error.hidden=true;
  preview.setAttribute('aria-busy','true');
  try{
    const src=`faces/${cat[0]}-${theme.slug}.svg`;
    const image=new Image();image.src=src;await image.decode();
    if(request!==revision)return;
    face.src=src;face.alt=`${cat[1]} in ${theme.name}. Sample readings.`;
    document.querySelector('.live-cat').textContent=cat[1];
    document.querySelector('.live-theme').textContent=theme.name;
  }catch{
    if(request!==revision)return;
    error.textContent='That preview couldn’t load. Choose another cat or theme to try again.';
    error.hidden=false;
  }finally{
    if(request===revision)preview.removeAttribute('aria-busy');
  }
}
function showPreview(){
  preview.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  catSelect.focus({preventScroll:true});
}
catButtons.forEach((button,i)=>button.addEventListener('click',()=>{selectedCat=i;update();showPreview()}));
catSelect.addEventListener('change',()=>{selectedCat=Number(catSelect.value);update()});
document.querySelectorAll('[data-family]').forEach(button=>button.addEventListener('click',()=>{
  selectedTheme=Number(button.dataset.family)*2+(themes[selectedTheme].dark?1:0);update();
}));
document.querySelectorAll('[data-theme]').forEach(button=>button.addEventListener('click',()=>{
  selectedTheme=Number(button.dataset.theme);update();showPreview();
}));
darkMode.addEventListener('click',()=>{selectedTheme^=1;update()});
document.querySelectorAll('.cat,.world-pick').forEach(button=>button.disabled=false);
document.documentElement.classList.add('js');
