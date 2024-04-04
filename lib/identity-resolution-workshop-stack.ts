import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import {aws_s3_deployment as s3deploy} from 'aws-cdk-lib';
import {aws_cloudfront as cloudfront} from 'aws-cdk-lib';
import {aws_cloudfront_origins as origins} from 'aws-cdk-lib';
import {aws_lambda as lambda} from 'aws-cdk-lib';
import { aws_kinesisfirehose as kinesisfirehose } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import {aws_entityresolution as entityresolution} from  'aws-cdk-lib';
import {aws_glue as glue} from 'aws-cdk-lib';
import {aws_apigateway as apigateway} from 'aws-cdk-lib';
import {aws_dynamodb as dynamodb} from 'aws-cdk-lib';
import {aws_lambda_event_sources as eventSource} from 'aws-cdk-lib';
import * as path from 'path';


export class IdentityResolutionWorkshopStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


    ////////Front-End///////////
    const websiteBucket = new s3.Bucket(this, 'front-end', {removalPolicy: cdk.RemovalPolicy.DESTROY});
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset('./assets/web')],
      destinationBucket: websiteBucket
    });
    new cloudfront.Distribution(this, 'Front-End-Dist', {
      defaultBehavior: { origin: new origins.S3Origin(websiteBucket) },
    }); 


    ////////AWS Glue////////////
   
  const rawdataBucket = new s3.Bucket(this, 'raw-data',{removalPolicy: cdk.RemovalPolicy.DESTROY});
    const gluedatabase = new glue.CfnDatabase(this, 'gluedatabase',{
      catalogId: this.account,
      databaseInput: {
        name: 'identityresolutionworkshop'}
    });

    const gluetable = new glue.CfnTable(this, 'gluetable',{
      catalogId: this.account,
      databaseName: 'identityresolutionworkshop',
      tableInput: {
        name: 'user-interaction',
        storageDescriptor: {
          location: 's3://'+rawdataBucket.bucketName+'/inbound/',
          parameters: {
            classification: 'json'
          },inputFormat: 'org.apache.hadoop.mapred.TextInputFormat',
          outputFormat: 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat',
          serdeInfo: {
            serializationLibrary: 'org.openx.data.jsonserde.JsonSerDe'
          },
          columns: [
            { name: 'event_id', type: 'string' },
            { name: 'fp_cookie_id', type: 'string' },
            { name: 'product_id', type: 'string' },
            { name: 'email', type: 'string' },
            { name: 'order_value', type: 'string' },
            { name: 'event_name', type: 'string' }]}
          }});


    ///////Amazon API Gateway///Amazon Kinesis Firehose////////////
    
     const firehoseRole = new iam.Role(this, 'firehoseRole', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
    });
    firehoseRole.addToPolicy(new iam.PolicyStatement({
      effect:iam.Effect.ALLOW,
      resources: [rawdataBucket.bucketArn,rawdataBucket.bucketArn+'/*'],
      actions: [ "s3:AbortMultipartUpload",
      "s3:GetBucketLocation",
      "s3:GetObject",
      "s3:ListBucket",
      "s3:ListBucketMultipartUploads",
      "s3:PutObject"],
    })); 

 const firehose = new kinesisfirehose.CfnDeliveryStream(this,'clickstream',{ 
  s3DestinationConfiguration:{
    bucketArn:rawdataBucket.bucketArn,
    roleArn:firehoseRole.roleArn,
    bufferingHints:{
      sizeInMBs:1,
      intervalInSeconds:60
    },
    prefix:'inbound/!{timestamp:yyyy}',
    errorOutputPrefix:'error/!{timestamp:yyyy}/!{firehose:error-output-type}'
  }
  })
  

  const apigatewayRole = new iam.Role(this, 'apigatewayRole', {
    assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
  });
  apigatewayRole.addToPolicy(new iam.PolicyStatement({
    effect:iam.Effect.ALLOW,
    resources: [firehose.attrArn],
    actions: [ "firehose:PutRecord"],
  })); 

  const requestTemplate = `
  {
    "DeliveryStreamName": "`+firehose.ref+`",
    "Record": { 
       "Data": "$util.base64Encode($input.json('$.Data'))"
    }
 }`
  
  const api = new apigateway.RestApi(this, 'identityresolutionworkshop-api');

api.root.addCorsPreflight({
  allowOrigins: ['*'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token', 'X-Amz-User-Agent'],
  allowCredentials: true,
})

  const user_interaction = api.root.addResource('user-interaction');
  

  user_interaction.addMethod('POST', new apigateway.AwsIntegration({
    service: 'firehose',
    action: 'PutRecord',
    options: {
      credentialsRole: apigatewayRole,
      requestTemplates: {
        "application/json": requestTemplate
      },
      integrationResponses: [{
        statusCode: '200',
        responseTemplates: {
          "application/json": `{}`
        }
      }
      ]
    },
  }), {

    methodResponses: [
      {
        statusCode: '200',
        responseModels: {
          "application/json": apigateway.Model.EMPTY_MODEL,
        },
      }
    ]
    
  }); 

  user_interaction.addCorsPreflight({
    allowOrigins: ['*'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token', 'X-Amz-User-Agent'],
    allowCredentials: true,
  })



  ///////////AWS Entity Resolution/////
  const outputdataBucket = new s3.Bucket(this, 'matchoutput',{removalPolicy: cdk.RemovalPolicy.DESTROY});

  const erRole = new iam.Role(this, 'erRole', {
    assumedBy: new iam.ServicePrincipal('entityresolution.amazonaws.com'),
  });

  
  const managedPolicy = iam.ManagedPolicy.fromAwsManagedPolicyName("AWSEntityResolutionConsoleFullAccess");
  erRole.addManagedPolicy(managedPolicy);

  erRole.addToPolicy(new iam.PolicyStatement({
    effect:iam.Effect.ALLOW,
    resources: [rawdataBucket.bucketArn,rawdataBucket.bucketArn+'/*'],
    actions: [  "s3:GetObject",
    "s3:ListBucket",
    "s3:GetBucketLocation"],
  })); 

  erRole.addToPolicy(new iam.PolicyStatement({
    effect:iam.Effect.ALLOW,
    resources: [outputdataBucket.bucketArn,outputdataBucket.bucketArn+'/*'],
    actions: [   "s3:PutObject",
    "s3:ListBucket",
    "s3:GetBucketLocation"],
  })); 

  erRole.addToPolicy(new iam.PolicyStatement({
    effect:iam.Effect.ALLOW,
    resources: ['arn:aws:glue:'+this.region+':'+this.account+':database/identityresolutionworkshop',
    'arn:aws:glue:'+this.region+':'+this.account+':table/identityresolutionworkshop/user-interaction',
    'arn:aws:glue:'+this.region+':'+this.account+':catalog'],
    actions: [  "glue:GetDatabase",
    "glue:GetTable",
    "glue:GetPartition",
    "glue:GetPartitions",
    "glue:GetSchema",
    "glue:GetSchemaVersion",
    "glue:BatchGetPartition"],
  }));

  const erSchema = new entityresolution.CfnSchemaMapping(this, 'erSchema', {
    schemaName:'eventschema',
    mappedInputFields:[
    {fieldName:'email',type:'EMAIL_ADDRESS',matchKey:'email'},
    {fieldName:'fp_cookie_id',type:'STRING',matchKey:'fp_cookie_id'},
    {fieldName:'event_name',type:'STRING'},
    {fieldName:'event_id',type:'UNIQUE_ID'},
    {fieldName:'product_id',type:'STRING'},
    {fieldName:'order_value',type:'STRING'}], 
    
  })

  const erMatchWorkflow = new entityresolution.CfnMatchingWorkflow(this, 'erMatchWorkflow', {
   inputSourceConfig:[{applyNormalization:true, inputSourceArn:'arn:aws:glue:'+this.region+':'+this.account+':table/identityresolutionworkshop/user-interaction', schemaArn:erSchema.attrSchemaArn}],
   outputSourceConfig:[{outputS3Path: 's3://'+outputdataBucket.bucketName+'/output/',output:[{hashed:false, name:'email'},{hashed:false, name:'fp_cookie_id'},{hashed:false, name:'event_name'},{hashed:false, name:'event_id'},{hashed:false, name:'product_id'},{hashed:false, name:'order_value'}]}],
   resolutionTechniques:{resolutionType:'RULE_MATCHING',
                      ruleBasedProperties:{attributeMatchingModel:'MANY_TO_MANY', 
                      rules:[{ruleName:'rule 1',matchingKeys:['fp_cookie_id']},{ruleName:'rule 2',matchingKeys:['email']}] 
                    }},
   roleArn:erRole.roleArn,
   workflowName:'identityresolutionworkshop-workflow'
  
  })  


  ////////////DynamoDB and Lambda////////

  const dyn_matched_events = new dynamodb.TableV2(this, 'matched-events', {
    partitionKey: { name: 'event_id', type: dynamodb.AttributeType.STRING },
    removalPolicy: cdk.RemovalPolicy.DESTROY
  });

  const matched_events_role = new iam.Role(this, 'matched-record-processor-role', {
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  });

  const lambdaBasicExecution = iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole");
  matched_events_role.addManagedPolicy(lambdaBasicExecution);

  matched_events_role.addToPolicy(new iam.PolicyStatement({
    effect:iam.Effect.ALLOW,
    resources: [dyn_matched_events.tableArn],
    actions: [ "dynamodb:BatchWriteItem","dynamodb:PutItem"],
  })); 

  matched_events_role.addToPolicy(new iam.PolicyStatement({
    effect:iam.Effect.ALLOW,
    resources: [outputdataBucket.bucketArn,outputdataBucket.bucketArn+'/*'],
    actions: [ "s3:GetObject","s3:ListBucket"],
  }));


  const matched_events = new lambda.Function(this, 'matched-record-processor', {
    runtime: lambda.Runtime.PYTHON_3_9,
    handler: 'lambda_function.lambda_handler',
    code: lambda.Code.fromAsset(path.join(__dirname, '../assets/lambda/matched-record-processor/')),
    role:matched_events_role,
    environment: {
      tableName: dyn_matched_events.tableName
    }
  });

  matched_events.addLayers(
    lambda.LayerVersion.fromLayerVersionArn(this, 'AWSDataWrangler-Python39', 'arn:aws:lambda:'+this.region+':336392948345:layer:AWSDataWrangler-Python39:1')
)


matched_events.addEventSource(new eventSource.S3EventSource(outputdataBucket, {
  events: [ s3.EventType.OBJECT_CREATED ],
  filters: [ { prefix: 'output/' } ] 
})); 


const get_profile_role = new iam.Role(this, 'get-profile--role', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
});


get_profile_role.addToPolicy(new iam.PolicyStatement({
  effect:iam.Effect.ALLOW,
  resources: [dyn_matched_events.tableArn],
  actions: [ "dynamodb:Scan"],
})); 

get_profile_role.addManagedPolicy(lambdaBasicExecution);

const get_profile = new lambda.Function(this, 'get-profile', {
  runtime: lambda.Runtime.PYTHON_3_11,
  handler: 'lambda_function.lambda_handler',
  code: lambda.Code.fromAsset(path.join(__dirname, '../assets/lambda/get-profile/')),
  role:get_profile_role,
  environment: {
    tableName: dyn_matched_events.tableName
  }
});



apigatewayRole.addToPolicy(new iam.PolicyStatement({
  effect:iam.Effect.ALLOW,
  resources: [get_profile.functionArn],
  actions: [ "lambda:InvokeFunction"],
})); 


const profile = api.root.addResource('profile');
profile.addMethod('GET', new apigateway.LambdaIntegration(get_profile)); 
profile.addCorsPreflight({
  allowOrigins: ['*'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token', 'X-Amz-User-Agent'],
  allowCredentials: true,
})
   
    
  }
}
