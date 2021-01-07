import {WSDLDefinitions} from "../models/WSDLDefinitions";
import { getRequestDataType } from "./SoapOperation";

export function SimpleSoapOperation(responseDataType: string, responseName: string): any {

  return (target: any, key: string, descriptor: TypedPropertyDescriptor<Function>) => {
    const requestDataType = getRequestDataType(target,key, descriptor);
    WSDLDefinitions.processOperation(target, key, requestDataType, responseDataType, responseName);
  };
}
