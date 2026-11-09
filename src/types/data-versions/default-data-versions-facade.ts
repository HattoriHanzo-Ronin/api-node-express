import type DataVersionsService from "../../services/data-versions-service.js";
import type DataVersionsMapper from "../../mappers/data-versions-mapper.js";

export type DataVersionsFacadeDependencies = {
    dataVersionsService: DataVersionsService;
    dataVersionsMapper: DataVersionsMapper;
};
