# Anonymous to Known Unified Customer View

The following diagram depicts a high-level technical architecture for using AWS Entity
Resolution to a create unified views of customers from your website:

![Architecture Diagarm](/content/Architecture_Diagram.png)

1. Data ingestion: Businesses ingest their customer data into AWS Entity Resolution with following pattern:

   - The user accesses the front-web web application via Amazon CloudFront.

   - Amazon API Gateway is used to capture the clickstream and respond the API calls.

   - Amazon API Gateway forward the clickstream to Amazon Kinesis Data Firehose process the data, apply transformation as needed and store the files in Amazon Simple Storage Service.

   - AWS Glue is used to catalogue the clickstream data hosted in the Amazon S3 into table.

2. Data preparation:

   - AWS Entity Resolution uses AWS Glue to define the schema from the created table

   - S3 Events trigger matching workflow once a new clickstream file ingested in the Amazon S3.

3. Entity matching:

   - AWS Entity Resolution matches customer profiles across the different datasets. This is done using a combination of Deterministic Rule-based matching, or Probabilistic Machine learning matching.

   - The AWS Entity Resolution workflow result is dropped in Amazon S3.

4. Data output:

   - AWS Lambda is triggered once the match workflow output is dropped in Amazon S3. The role of AWS Lambda is to process the matched records from Amazon S3 and ingest them in Amazon DynamoDB table

   - Once the customer profiles have been matched, you can enrich the data with additional information, such as demographics, interests, and purchase history utilizing the AWS Entity Resolution data service provider matching workflow

5. Unified Profile Lookup:

   - Once the AWS Entity Resolution job is completed and the matched records are stored in Amazon DynamoDB table, the front-end web application can retrieve the unified record views using AWS Lambda invoked via API call from the Amazon API Gateway.

   - The AWS Lambda function uses AWS SDK to query the Amazon DynamoDB table and return the unified record views to the front-end web application.

## How to deploy the architecture using AWS CDK

### Prerequisites

Make sure that you complete the following steps as prerequisites:

- Have an AWS account. For this post, you configure the required AWS resources using [AWS CloudFormation](https://aws.amazon.com/cloudformation/). If you haven’t signed up, complete the following tasks:
  - Create an account. For instructions, see [Sign Up for AWS](https://aws.amazon.com/premiumsupport/knowledge-center/create-and-activate-aws-account/))
  - Create an [AWS Identity and Access Management (IAM) role](http://aws.amazon.com/iam). For instructions, see [Create IAM Role](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-user.html).
- [Setup AWS account profile](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html)
- Have the following installed and configured on your machine:
  - [AWS Command Line Interface (AWS CLI), authenticated and configured](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)
  - Install [Nodejs](https://nodejs.org/en)
  - [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html)
  - [Git](http://git-scm.com/downloads)

### Deployment

1. Update cdk.json **profile** property to match your profile name configuration. For more info visit [Configuration and credential file settings](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)
2. Run `cdk bootstrap`
3. Run `cdk deploy`

## Solution Demo

The following diagram shows how the proposed identity resolution solution works when a customer visits a website from two different devices:
![Demo Diagram](/content/demo-flow.png)

- Day 1: The user visits the website from device A and interacted with its content to generate two events: “View Product” and “Add To Cart”. However, the user still Anonymous since no 1st party identifier and it is only identifier using a first-party cookie (1234).
- Day 2: The user visits again the same website from the same device A and proceeds to register using email address (user@email.com). At this stage, the solution will link the first-party cookie (1234) with email address (user@email.com) since it belongs to the same user.
- Day 3: The user receives a marketing email sent to user@email.com and clicks on the link within the email to land on the same website from a different device B. Since it is a new device the website tracking capability assign a new first-party cookie (5678) to the user in device B. Then, the user sign-in using email address user@email.com. The solution will link the first-party cookie set in device B (5678) to the used email address user@email.com.  
  As a result, the solution will be able to link all events from both devices from Anonymous to known stage using first-party cookies and email address first-party identifier.

Once the AWS CDK deployment is completed successfully, follow the below steps to demo the solution:

1. Navigate from AWS Console to the created Amazon CloudFront distribution and copy the distribution domain name:
   ![Amazon CloudFront Distribution](/content/Amazon_CloudFront_Distribution.png)

2. Paste the Amazon CloudFront distribution domain name in a browser then add `/index.html` to the end of the URL. You should land on the demo web page:
   ![Web Page Demo](/content/web-1.png)

3. Navigate from AWS Console to the created Amazon API Gateway > Stages and copy the Invoke URL:
   ![Amazon API Gateway Invoke URL](/content/api-gateway-url.png)

4. From the demo web page visited in step 2, click on **Step 1: Amazon API Gateway Endpoint Configuration**, past the Amazon API Gateway Invoke URL and click **Save Endpoint**
   ![Save Endpoint](/content/save-endpoint.png)

5. From the demo web page visited in step 2, click on **Step 2: User Interactions**, using the below details fill the user interaction data and click **Send User Interactions** 1. Event: **View Product** | Product Id: **P1** 2. Event: **Add To Cart** | Product Ids: **P1** 3. Event: **Place Order** | User Email: **user@email.com** | Product Ids: **P1** | Order Value: **1200**
   ![Place Order](/content/place-order.png)

6. Navigate from AWS Console to the created AWS Entity Resolution workflow and click **Run Workflow**
   ![Run Workflow](/content/run-workflow.png)

7. Once the AWS Entity Resolution workflow job status is set to **Completed**, from the demo web page visited in step 2, click on **Step 3: Retrieve User Profile** and then click:
   - **Get User Profile Using 1st Party Cookie** Or
   - Set User Email to **user@email.com** and click **Get User Profile Using Email Address**.

You should receive a table containing all the events related to the user including the 1st party cookie and email value:
![Profile Lookup](/content/profile-lookup-1.png)

8. Using another device or browser to simulate another device repeat Step 1 till step 4. Then, from the demo web page visited in step 2, click on **Step 2: User Interactions**, using the below details fill the user interaction data and click **Send User Interactions** 1. Event: **Sign In** | User Email: **user@email.com**
   ![Profile Lookup](/content/sign-in.png)

9. Navigate from AWS Console to the created AWS Entity Resolution workflow and click **Run Workflow** similar to Step 6

10. Once the AWS Entity Resolution workflow job status is set to **Completed**, from the demo web page visited in step 2 using the new device or web browser, click on **Step 3: Retrieve User Profile** and then click:
    - **Get User Profile Using 1st Party Cookie** Or
    - Set User Email to **user@email.com** and click **Get User Profile Using Email Address**.

You should receive a table containing all the events related to the user including the 1st party cookie and email value:
![Profile Lookup](/content/profile-lookup-2.png)

## Cleanup

- Run `cdk destroy`

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

---

## Authors and acknowledgment

- Ghandi Nader
- Amit Deol

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
