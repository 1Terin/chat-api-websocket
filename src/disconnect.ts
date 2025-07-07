import { APIGatewayProxyWebsocketEventV2, APIGatewayProxyResultV2 } from "aws-lambda"; 
import { deleteConnection } from "./util";

export const handler: (event: APIGatewayProxyWebsocketEventV2) => Promise<APIGatewayProxyResultV2> = async (event) => {
    console.log("Disconnect event:", JSON.stringify(event, null, 2));

    const connectionId = event.requestContext.connectionId;
    if (!connectionId) {
        return { statusCode: 400, body: "ConnectionId not found." };
    }

    try {
        await deleteConnection(connectionId);
        return { statusCode: 200, body: "Disconnected." };
    } catch (error) {
        console.error("Error disconnecting:", error);
        return { statusCode: 500, body: "Failed to disconnect." };
    }
};