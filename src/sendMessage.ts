import { APIGatewayProxyWebsocketEventV2, APIGatewayProxyResultV2 } from "aws-lambda"; 
import {
    createAPIGatewayClient,
    getConnectionsByGroupId,
    sendMessageToClient,
    addConnection,
    getAllConnections
} from "./util";

export const handler: (event: APIGatewayProxyWebsocketEventV2) => Promise<APIGatewayProxyResultV2> = async (event) => {
    console.log("SendMessage event:", JSON.stringify(event, null, 2));

    const connectionId = event.requestContext.connectionId; 
    const requestContext = event.requestContext;

    if (!connectionId || !event.body) {
        return { statusCode: 400, body: "Missing connectionId or request body." };
    }

    let parsedBody: { groupId?: string; message: string };
    try {
        parsedBody = JSON.parse(event.body);
    } catch (error) {
        return { statusCode: 400, body: "Invalid JSON in request body." };
    }

    const { groupId, message } = parsedBody;
    if (!message) {
        return { statusCode: 400, body: "Missing 'message' in request body." };
    }

    const apiGatewayClient = createAPIGatewayClient(requestContext);

    try {
        let connectionsToSendTo;

        if (groupId) {
            await addConnection({
                connectionId: connectionId,
                groupId: groupId,
                timestamp: Date.now(),
            });

            connectionsToSendTo = await getConnectionsByGroupId(groupId);
        } else {
            connectionsToSendTo = await getAllConnections();
        }

        const postCalls = connectionsToSendTo.map(async (connection) => {
            return sendMessageToClient(apiGatewayClient, connection.connectionId, {
                type: "message",
                groupId: groupId || "broadcast",
                senderId: connectionId,
                message: message,
                timestamp: Date.now(),
            });
        });

        await Promise.allSettled(postCalls);

        return { statusCode: 200, body: "Message sent." };
    } catch (error) {
        console.error("Error sending message:", error);
        return { statusCode: 500, body: `Failed to send message: ${error}` };
    }
};