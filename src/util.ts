import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { APIGatewayEventWebsocketRequestContextV2 } from "aws-lambda"; 

const TABLE_NAME = process.env.TABLE_NAME || "ChatConnections";

const client = new DynamoDBClient({});
export const ddbDocClient = DynamoDBDocumentClient.from(client);

export const createAPIGatewayClient = (requestContext: APIGatewayEventWebsocketRequestContextV2) => {
    const endpoint = `https://${requestContext.domainName}/${requestContext.stage}`;
    return new ApiGatewayManagementApiClient({ endpoint });
};

export interface ChatConnection {
    connectionId: string;
    groupId?: string;
    timestamp: number;
}

export const addConnection = async (connection: ChatConnection) => {
    const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: connection,
    });
    await ddbDocClient.send(command);
};

export const deleteConnection = async (connectionId: string) => {
    const command = new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { connectionId },
    });
    await ddbDocClient.send(command);
};

export const getConnectionsByGroupId = async (groupId: string): Promise<ChatConnection[]> => {
    const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "groupId = :groupId",
        ExpressionAttributeValues: {
            ":groupId": groupId,
        },
    });
    const { Items } = await ddbDocClient.send(command);
    return (Items as ChatConnection[]) || [];
};

export const getAllConnections = async (): Promise<ChatConnection[]> => {
    const command = new ScanCommand({
        TableName: TABLE_NAME,
    });
    const { Items } = await ddbDocClient.send(command);
    return (Items as ChatConnection[]) || [];
};

export const sendMessageToClient = async (
    apiGatewayClient: ApiGatewayManagementApiClient,
    connectionId: string,
    data: any
) => {
    try {
        await apiGatewayClient.send(
            new PostToConnectionCommand({
                ConnectionId: connectionId,
                Data: JSON.stringify(data),
            })
        );
    } catch (error: any) {
        if (error.statusCode === 410) {
            console.warn(`Stale connection detected: ${connectionId}. Deleting.`);
            await deleteConnection(connectionId);
        } else {
            console.error(`Error sending message to ${connectionId}:`, error);
            throw error;
        }
    }
};