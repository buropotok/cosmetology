chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}).catch(console.warn);
chrome.runtime.onMessage.addListener((m,_s)=>{if(m.type==='OPEN_PANEL')chrome.windows.getCurrent(w=>{if(w.id)chrome.sidePanel.open({windowId:w.id}).catch(console.warn)})});
