import {
  WSDL_URL, SOAP_URL, XSD_URL, XMLNS_NS, WSDL_NS, PORT_TYPE_SUFFIX, BINDING_SUFFIX,
  MESSAGE_SUFFIX, XSD_NS
} from "../utils";
import {WSDLBinding} from "./WSDLBinding";
import {WSDLService} from "./WSDLService";
import {WSDLPortType} from "./WSDLPortType";
import {WSDLMessage} from "./WSDLMessage";
import {WSDLOperation} from "./WSDLOperation";
import {XMLAttribute} from "xml-decorators";
import {XMLChild} from "xml-decorators";
import {XSDSchema, XSDComplexTypeModel, XSDElementModel} from "xsd-decorators";
import {CURRENT_URL_PLACEHOLDER} from "../overrides/soap-server";
import {ISoapServiceOptions} from "../interfaces/ISoapServiceOptions";

const REFLECT_KEY = 'wsdl:definitions';

export class WSDLDefinitions {

  @XMLAttribute({namespace: XMLNS_NS})
  soap: string = SOAP_URL;

  @XMLAttribute({namespace: XMLNS_NS})
  xsd: string = XSD_URL;

  @XMLAttribute({namespace: XMLNS_NS})
  wsdl: string = WSDL_URL;

  @XMLAttribute
  private name: string;

  @XMLAttribute
  private targetNamespace: string;

  @XMLAttribute({namespace: XMLNS_NS})
  private tns: string;

  @XMLChild({
    namespace: XSD_NS,
    implicitStructure: 'wsdl:types.$'
  })
  private readonly schema: XSDSchema;

  @XMLChild({
    name: 'message',
    namespace: WSDL_NS,
  })
  private messages: WSDLMessage[];
  private hasMessage: {[messageName: string]: boolean} = {};

  @XMLChild({namespace: WSDL_NS})
  private portType: WSDLPortType;

  @XMLChild({namespace: WSDL_NS})
  private binding: WSDLBinding;

  @XMLChild({namespace: WSDL_NS})
  private service: WSDLService;

  private servicePath?: string;

  static processService(target: any, options: ISoapServiceOptions): void {

    options = Object.assign(options);

    const definitions = this.getOrCreateIfNotExists(target);

    definitions.servicePath = options.path;

    definitions.targetNamespace = options.targetNamespace || CURRENT_URL_PLACEHOLDER;
    definitions.tns = definitions.targetNamespace;
    definitions.name = options.serviceName;

    definitions.schema.setTargetNamespace(definitions.targetNamespace);
    definitions.portType.setName(options.portName + PORT_TYPE_SUFFIX);

    definitions.binding.setName(options.serviceName + BINDING_SUFFIX);
    definitions.binding.setType(definitions.portType.nsName);

    definitions.service = new WSDLService({
      name: options.serviceName,
      port: {
        binding: definitions.binding.nsName,
        name: options.portName,
        address: {location: options.locationAddress || CURRENT_URL_PLACEHOLDER}
      }
    });
  }

  static processOperation(target: string, key: string, requestDataType: any, responseDataType: any, responseName?: string): void {

    const definitions = this.getOrCreateIfNotExists(target);
    const requestMessage = this.createWSDLRequestPart(key, definitions, requestDataType);

    var responseMessage: WSDLMessage;
    if(!responseName){
      responseMessage = this.createWSDLResponsePartComplexType(definitions, responseDataType);
    } else {
      responseMessage = this.createWSDLResponsePartSimpleType(definitions, responseDataType, responseName);
    }

    this.createWSDLPortTypePart(key, definitions, requestMessage, responseMessage);
    this.createWSDLBindingPart(key, definitions, requestMessage, responseMessage);
  }

  static createWSDLRequestPart(key: string, definitions: WSDLDefinitions, requestDataType: any){
    const requestComplexType = XSDComplexTypeModel.getXSDComplexType(requestDataType.prototype);
    if (!requestComplexType) throw new Error(`"${requestDataType.name}" is not a complex type`);
    const requestElement = XSDElementModel.createElement({name: key}, requestComplexType, requestDataType);
    definitions.schema.addElement(requestElement);
    const requestMessage = new WSDLMessage({
      name: key + MESSAGE_SUFFIX,
      part: {name: key, element: requestElement.nsName}
    });
    definitions.addMessage(requestMessage);
    return requestMessage;
  }

  static createWSDLResponsePartComplexType(definitions: WSDLDefinitions, responseDataType: any){
    const responseComplexType = XSDComplexTypeModel.getXSDComplexType(responseDataType.prototype);
    if (!responseComplexType) throw new Error(`"${responseDataType.name}" is not a complex type`);
    const responseElement = XSDElementModel.createElement({name: responseComplexType.name}, responseComplexType, responseDataType);
    definitions.schema.addElement(responseElement);
    const responsePartName = responseComplexType.name;
    const responseMessage = new WSDLMessage({
      name: responseComplexType.name + MESSAGE_SUFFIX,
      part: {name: responsePartName, element: responseElement.nsName}
    });
    definitions.addMessage(responseMessage);
    return responseMessage;
  }

  static createWSDLResponsePartSimpleType(definitions: WSDLDefinitions, responseDataType: string, responseName: string) {
    const responseElement = XSDElementModel.createElement({name: responseName, type: responseDataType})
    definitions.schema.addElement(responseElement);
    const responseMessage = new WSDLMessage({
      name: responseName + MESSAGE_SUFFIX,
      part: {name: responseName, element: responseElement.nsName}
    });
    definitions.addMessage(responseMessage);
    return responseMessage;
  }

  static createWSDLPortTypePart(key: string, definitions: WSDLDefinitions, requestMessage: WSDLMessage, responseMessage: WSDLMessage){
    definitions.portType.addOperation(new WSDLOperation({
      name: key,
      input: {message: requestMessage.nsName},
      output: {message: responseMessage.nsName}
    }));
  }

  static createWSDLBindingPart(key: string, definitions: WSDLDefinitions, requestMessage: WSDLMessage, responseMessage: WSDLMessage){
    definitions.binding.addOperation(new WSDLOperation({
      name: key,
      soapOperation: true,
      input: {body: {parts: requestMessage.part.name}},
      output: {body: {parts: responseMessage.part.name}}
    }));
  } 

  static getWSDLDefinitions(target: any): WSDLDefinitions|undefined {

    return Reflect.getMetadata(REFLECT_KEY, target);
  }

  static setWSDLDefinitions(target: any, definitions: WSDLDefinitions): void {

    Reflect.defineMetadata(REFLECT_KEY, definitions, target);
  }

  private static getOrCreateIfNotExists(target: any): WSDLDefinitions {
    let definitions = this.getWSDLDefinitions(target);

    if (!definitions) {

      definitions = new WSDLDefinitions();
      this.setWSDLDefinitions(target, definitions);
    }
    return definitions;
  }

  getServiceName(): string {

    return this.service.name;
  }

  getPortName(): string {

    return this.service.port.name;
  }

  getServicePath(): string|undefined {

    return this.servicePath;
  }

  private constructor() {

    this.schema = new XSDSchema();
    this.portType = new WSDLPortType();
    this.binding = new WSDLBinding();
    this.messages = [];
  }

  private addMessage(message: WSDLMessage): void {

    if (!this.hasMessage[message.name]) {

      this.messages.push(message);
      this.hasMessage[message.name] = true;
    }
  }
}
