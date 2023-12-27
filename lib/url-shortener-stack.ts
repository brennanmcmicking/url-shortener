import * as cdk from 'aws-cdk-lib';
import { RemovalPolicy } from 'aws-cdk-lib';
import { EndpointType, LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { AttributeType, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { ApiGateway } from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';

export class UrlShortenerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);
    const stage = props.description;
    const isTest = stage !== 'prod';

    const shortUrl = (isTest ? 'ds' : 's') + '.brnn.ca';

    const fullDomainCert = Certificate.fromCertificateArn(this, `FullCert-${stage}`,
          'arn:aws:acm:us-east-1:446708209687:certificate/954abdfb-b567-498e-af2b-02669ff4507a');

    const shortDomainCert = Certificate.fromCertificateArn(this, `ShortCert-${stage}`,
          'arn:aws:acm:us-east-1:446708209687:certificate/4595cf3a-4100-4291-a0b7-ce0852fb8145') 

    const table = new Table(this, `ForwardingTable-${stage}`, {
      tableName: `ForwardingTable-${stage}`,
      partitionKey: {
        name: 'hash',
        type: AttributeType.STRING,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const shortener = new Function(this, `UrlShortenerFunction-${stage}`, {
      runtime: Runtime.PYTHON_3_10,
      code: Code.fromAsset("resources/shortener"),
      handler: "shortener.handler",
      environment: {
        TABLE_NAME: table.tableName,
        SHORT_API_URL: `https://${shortUrl}`,
        // SHORT_API_URL: 'https://ag5us52y0a.execute-api.us-west-2.amazonaws.com/dev',
      },
    });

    const forwarder = new Function(this, `UrlForwarderFunction-${stage}`, {
      runtime: Runtime.PYTHON_3_10,
      code: Code.fromAsset("resources/forwarder"),
      handler: "forwarder.handler",
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    table.grantReadWriteData(shortener);
    table.grantFullAccess(forwarder);

    const shortenerApi = new RestApi(this, `ShortenerApi-${stage}`, {
      deployOptions: {
        stageName: stage,
        throttlingBurstLimit: 10,
        throttlingRateLimit: 10,
      },
      // domainName: {
      //   domainName: (isTest ? 'devapi' : 'api') + '.brennanmcmicking.net',
      //   certificate: fullDomainCert,
      //   basePath: 'v1',
      //   endpointType: EndpointType.EDGE,
      // }
    });

    const forwarderApi = new RestApi(this, `ForwarderApi-${stage}`, {
      deployOptions: {
        stageName: stage,
        throttlingBurstLimit: 10,
        throttlingRateLimit: 10,
      },
      domainName: {
        domainName: shortUrl,
        certificate: shortDomainCert,
        endpointType: EndpointType.EDGE,
      }
    });

    const shorten = shortenerApi.root.addResource("shorten");
    shorten.addMethod('POST', new LambdaIntegration(shortener), {
      apiKeyRequired: isTest,
    });

    const forward = forwarderApi.root.addResource("{hash}");
    forward.addMethod('GET', new LambdaIntegration(forwarder), {
      apiKeyRequired: isTest,
    });

    if (isTest) {
      const shortenerKey = shortenerApi.addApiKey(`ShortenerApiKey-${stage}`);
      const shortenerPlan = shortenerApi.addUsagePlan(`ApiUsagePlan-${stage}`, {
        name: 'ShortenerDev'
      });
      shortenerPlan.addApiKey(shortenerKey);
      shortenerPlan.addApiStage({
        api: shortenerApi,
        stage: shortenerApi.deploymentStage,
      });

      const forwarderKey = forwarderApi.addApiKey(`ForwarderApiKey-${stage}`);
      const forwarderPlan = forwarderApi.addUsagePlan(`ApiUsagePlan-${stage}`, {
        name: 'ForwarderDev'
      });
      forwarderPlan.addApiKey(forwarderKey);
      forwarderPlan.addApiStage({
        api: forwarderApi,
        stage: forwarderApi.deploymentStage,
      });
    }

    const shortHostedZone = HostedZone.fromHostedZoneAttributes(this, `HostedZone-${stage}`, {
      hostedZoneId: 'Z03423443O6HCVVPFMSAH',
      zoneName: 'brnn.ca',
    });

    new ARecord(this, `ShortARecord-${stage}`, {
      zone: shortHostedZone,
      recordName: shortUrl,
      target: RecordTarget.fromAlias(new ApiGateway(forwarderApi)),
    });
  }
}
