// interfaces
interface IEvent {
  type(): string;
  machineId(): string;
}

interface ISubscriber {
  handle(event: IEvent): void;
}

interface IPublishSubscribeService {
  publish (event: IEvent): void;
  subscribe (type: string, handler: ISubscriber): void;
  // unsubscribe ( /* Question 2 - build this feature */ );
  unsubscribe(type: string, handler: ISubscriber): void;
}


// implementations
class PublishSubscribeService implements IPublishSubscribeService {
  private subscribers: { [key: string]: ISubscriber[] } = {};

  subscribe(type: string, handler: ISubscriber): void {
    if (!this.subscribers[type]) {
      this.subscribers[type] = [];
    }
    this.subscribers[type].push(handler);
  }

  unsubscribe(type: string, handler: ISubscriber): void {
    const subscribers = this.subscribers[type];
    if (subscribers) {
      this.subscribers[type] = subscribers.filter(subscriber => subscriber !== handler);
    }
  }

  publish(event: IEvent): void {
    const subscribers = this.subscribers[event.type()];
    if (subscribers) {
      subscribers.forEach(subscriber => subscriber.handle(event));
    }
  }
}

class MachineSaleEvent implements IEvent {
  constructor(private readonly _sold: number, private readonly _machineId: string) {}

  machineId(): string {
    return this._machineId;
  }

  getSoldQuantity(): number {
    return this._sold
  }

  type(): string {
    return 'sale';
  }
}

class MachineRefillEvent implements IEvent {
  constructor(private readonly _refill: number, private readonly _machineId: string) {}

  machineId(): string {
    return this._machineId;
  }

  getRefillQuantity(): number {
    return this._refill;
  }

  type(): string {
    return 'refill';
  }
}

class LowStockWarningEvent implements IEvent {
  constructor(private readonly _machineId: string) {}

  machineId(): string {
    return this._machineId;
  }

  type(): string {
    return 'lowStockWarning';
  }
}

class StockLevelOkEvent implements IEvent {
  constructor(private readonly _machineId: string) {}

  machineId(): string {
    return this._machineId;
  }

  type(): string {
    return 'stockLevelOk';
  }
}

class MachineSaleSubscriber implements ISubscriber {
  public machines: Machine[];
  private pubSubService: IPublishSubscribeService;


  constructor (machines: Machine[], pubSubService: IPublishSubscribeService) {
    this.machines = machines;
    this.pubSubService = pubSubService; 
  }

  handle(event: MachineSaleEvent): void {
    const machineIndex = this.machines.findIndex(machine => machine.id === event.machineId());

    if (machineIndex !== -1) {
      const soldQty = event.getSoldQuantity();
      this.machines[machineIndex].stockLevel -= soldQty;

      // Check if stock level drops below 3 and no warning event has been fired yet
      if (this.machines[machineIndex].stockLevel < 3) {
        this.pubSubService.publish(new LowStockWarningEvent(this.machines[machineIndex].id));
      }
    }
  }
}

class MachineRefillSubscriber implements ISubscriber {
  public machines: Machine[];
  private pubSubService: IPublishSubscribeService;

  constructor(machines: Machine[], pubSubService: IPublishSubscribeService) {
    this.machines = machines;
    this.pubSubService = pubSubService;
  }

  handle(event: MachineRefillEvent): void {
    const machineIndex = this.machines.findIndex(machine => machine.id === event.machineId());

    if (machineIndex !== -1) {
      const previousStockLevel = this.machines[machineIndex].stockLevel;
      const refillQty = event.getRefillQuantity();
      this.machines[machineIndex].stockLevel += refillQty;

      // Check if stock level transitions from below 3 to 3 or above, and a warning event has been fired
      if (previousStockLevel < 3 && this.machines[machineIndex].stockLevel >= 3) {
        this.pubSubService.publish(new StockLevelOkEvent(this.machines[machineIndex].id));
      }
    }
  }
}

class LowStockWarningSubscriber implements ISubscriber {
  constructor(private machines: Machine[], private pubSubService: IPublishSubscribeService) {}

  handle(event: IEvent): void {
    if (event instanceof MachineSaleEvent) {
      const machineIndex = this.machines.findIndex(machine => machine.id === event.machineId());

      if (machineIndex !== -1 && this.machines[machineIndex].stockLevel < 3 && !this.machines[machineIndex].isLowStockWarningFired()) {
        this.machines[machineIndex].setLowStockWarningFired(true);
        this.pubSubService.publish(new LowStockWarningEvent(this.machines[machineIndex].id));
      }
    }
  }
}

class StockLevelOkSubscriber implements ISubscriber {
  constructor(private machines: Machine[], private pubSubService: IPublishSubscribeService) {}

  handle(event: IEvent): void {
    if (event instanceof MachineRefillEvent) {
      const machineIndex = this.machines.findIndex(machine => machine.id === event.machineId());

      if (machineIndex !== -1 && this.machines[machineIndex].stockLevel >= 3 && !this.machines[machineIndex].isStockLevelOkFired()) {
        this.machines[machineIndex].setStockLevelOkFired(true);
        this.pubSubService.publish(new StockLevelOkEvent(this.machines[machineIndex].id));
      }
    }
  }
}



// objects
class Machine {
  public stockLevel = 10;
  public id: string;
  private lowStockWarningFired: boolean = false;
  private stockLevelOkFired: boolean = false;

  constructor (id: string) {
    this.id = id;
  }

  public setLowStockWarningFired(value: boolean): void {
    this.lowStockWarningFired = value;
  }

  public isLowStockWarningFired(): boolean {
    return this.lowStockWarningFired;
  }

  public setStockLevelOkFired(value: boolean): void {
    this.stockLevelOkFired = value;
  }

  public isStockLevelOkFired(): boolean {
    return this.stockLevelOkFired;
  }
}


// helpers
const randomMachine = (): string => {
  const random = Math.random() * 3;
  if (random < 1) {
    return '001';
  } else if (random < 2) {
    return '002';
  }
  return '003';

}

const eventGenerator = (): IEvent => {
  const random = Math.random();
  if (random < 0.5) {
    const saleQty = Math.random() < 0.5 ? 1 : 2; // 1 or 2
    return new MachineSaleEvent(saleQty, randomMachine());
  } 
  const refillQty = Math.random() < 0.5 ? 3 : 5; // 3 or 5
  return new MachineRefillEvent(refillQty, randomMachine());
}


// program
(async () => {
  // create 3 machines with a quantity of 10 stock
  const machines: Machine[] = [ new Machine('001'), new Machine('002'), new Machine('003') ];

  // create the PubSub service
  const pubSubService: IPublishSubscribeService = new PublishSubscribeService(); // implement and fix this
  
  // create a machine sale event subscriber. inject the machines (all subscribers should do this)
  const saleSubscriber = new MachineSaleSubscriber(machines, pubSubService);

  // create a machine refill event subscriber. inject the machines and the pubSubService
  const refillSubscriber = new MachineRefillSubscriber(machines, pubSubService);

  // create a low stock warning event subscriber. inject the machines and the pubSubService
  const lowStockWarningSubscriber = new LowStockWarningSubscriber(machines, pubSubService);

  // create a stock level OK event subscriber. inject the machines and the pubSubService
  const stockLevelOkSubscriber = new StockLevelOkSubscriber(machines, pubSubService);

  // subscribe the sale subscriber to 'sale' events
  pubSubService.subscribe('sale', saleSubscriber);

  // subscribe the refill subscriber to 'refill' events
  pubSubService.subscribe('refill', refillSubscriber);

  // subscribe the low stock warning subscriber to 'low_stock_warning' events
  pubSubService.subscribe('low_stock_warning', lowStockWarningSubscriber);

  // subscribe the stock level OK subscriber to 'stock_level_ok' events
  pubSubService.subscribe('stock_level_ok', stockLevelOkSubscriber);

  // create 5 random events
  const events = [1,2,3,4,5].map(i => eventGenerator());

  // publish the events
  events.forEach(pubSubService.publish);
})();
