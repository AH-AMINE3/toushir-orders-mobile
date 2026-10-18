import { Address, Order, User } from './api';
export type CourierLine = {id:string;productId:string;name:string;imageUrl?:string;quantity:number;preparedQuantity?:number;acceptedQuantity?:number;refusedQuantity?:number};
export type Assignment = {driverId:string;driverName:string;status:string;routeId?:string;assignedAt:string;pickedUpAt?:string;arrivedAt?:string};
export type CourierOrder = {id:string;number:string;status:string;paymentStatus:string;total:number|null;merchant:User;items:CourierLine[];address:Address;version:number;assignment:Assignment;balance:{due:number;collected:number;remaining:number;refundDue:number}};
export type DriverLocation = {latitude:number;longitude:number;accuracy:number;capturedAt:string;receivedAt:string;isFresh:boolean;ageSeconds:number};
export type Tracking = {order:Order;version:number;preparation:any;assignment:Assignment|null;location:DriverLocation|null};
export type ReceiptSelection = {productId:string;acceptedQuantity:number;refusedQuantity:number};
