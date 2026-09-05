(()=>{
  const screen=document.querySelector('#composer-screen');
  const form=document.querySelector('#publish-form');
  if(!screen||!form||document.querySelector('#publish-ai-wizard'))return;

  const root=document.createElement('section');
  root.id='publish-ai-wizard';
  root.className='publish-ai-wizard';
  root.setAttribute('aria-label','Cosmo Sofa AI');
  root.innerHTML=`
    <div class="publish-ai-wizard__header">
      <span class="publish-ai-wizard__logo" aria-hidden="true">✦</span>
      <div><strong>Cosmo Sofa AI</strong><span>Подготовит идею, текст и изображение</span></div>
    </div>
    <div class="publish-ai-wizard__presets" role="group" aria-label="Темы">
      <button type="button" class="is-active">✨ Идея дня</button>
      <button type="button">Новости</button>
      <button type="button">Мифы</button>
      <button type="button">Интересные факты</button>
    </div>
    <form class="publish-ai-wizard__prompt">
      <input type="text" placeholder="Введите свою идею" aria-label="Своя идея" autocomplete="off">
      <button type="submit" aria-label="Отправить идею">↑</button>
    </form>
    <button type="button" class="publish-ai-wizard__manual">
      <img src="/assets/icons/manual-edit.svg" alt="" aria-hidden="true">
      <span>Ручное создание публикации</span>
    </button>`;

  form.insertAdjacentElement('beforebegin',root);

  const presetButtons=[...root.querySelectorAll('.publish-ai-wizard__presets button')];
  presetButtons.forEach(button=>button.addEventListener('click',()=>{
    presetButtons.forEach(item=>item.classList.toggle('is-active',item===button));
  }));

  root.querySelector('.publish-ai-wizard__prompt')?.addEventListener('submit',event=>{
    event.preventDefault();
    const input=root.querySelector('.publish-ai-wizard__prompt input');
    const message=input?.value.trim();
    if(message)window.dispatchEvent(new CustomEvent('cosmo-ai-wizard-submit',{detail:{message}}));
  });

  root.querySelector('.publish-ai-wizard__manual')?.addEventListener('click',()=>{
    root.hidden=true;
    document.querySelector('#text')?.focus();
    window.dispatchEvent(new CustomEvent('cosmo-ai-wizard-manual'));
  });
})();
