(()=>{
class TelegramGateway{
  constructor({webApp=window.Telegram?.WebApp,locationImpl=window.location,alertImpl=window.alert.bind(window)}={}){this.webApp=webApp;this.locationImpl=locationImpl;this.alertImpl=alertImpl}
  isAvailable(){return!!this.webApp}
  getInitData(){return this.webApp?.initData||''}
  requestManagedBot(requestId){return new Promise((resolve,reject)=>{if(typeof this.webApp?.requestChat!=='function')return reject(new Error('Telegram requestChat недоступен.'));this.webApp.requestChat(requestId,resolve)})}
  openTelegramLink(url){if(this.webApp?.openTelegramLink)this.webApp.openTelegramLink(url);else this.locationImpl.assign(url)}
  openExternalLink(url,options={try_instant_view:false}){if(this.webApp?.openLink)this.webApp.openLink(url,options);else this.locationImpl.assign(url)}
  showAlert(message){if(this.webApp?.showAlert)this.webApp.showAlert(message);else this.alertImpl(message)}
  notifySelection(){this.webApp?.HapticFeedback?.selectionChanged?.()}
}

window.CosmoTelegramGateway=Object.freeze({TelegramGateway,create:options=>new TelegramGateway(options)});
})();
