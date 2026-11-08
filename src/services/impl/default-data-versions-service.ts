import type DataVersionsService from "../data-versions-service.js";
import type { DataVersionId, DataVersionIds } from "../../types/data-versions-model.js";
import type { DataVersionsServiceDependencies } from "../../types/default-data-versions-service.js";

/**
 * Default data versions service
 *
 * @author HattoriHanzo-Ronin
 */
export default class DefaultDataVersionsService implements DataVersionsService {
    private readonly dataVersionsModel: DataVersionsServiceDependencies["dataVersionsModel"];

    constructor({ dataVersionsModel }: DataVersionsServiceDependencies) {
        this.dataVersionsModel = dataVersionsModel;
    }

    async getById({ id }: DataVersionId) {
        return this.dataVersionsModel.getById({ id });
    }

    async getByIds({ ids }: DataVersionIds) {
        return this.dataVersionsModel.getByIds({ ids });
    }
}
