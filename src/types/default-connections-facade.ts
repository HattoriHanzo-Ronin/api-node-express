import type ConnectionsService from "../services/connections-service.js";
import type ConnectionsMapper from "../mappers/connections-mapper.js";

export type ConnectionsFacadeDependencies<Transaction> = {
    connectionsService: ConnectionsService<Transaction>;
    connectionsMapper: ConnectionsMapper;
};
