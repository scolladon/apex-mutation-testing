export interface MetadataComponentDependency {
  Id: string
  RefMetadataComponentType: string
  RefMetadataComponentName: string
  [key: string]: string | number | boolean | null | undefined
}
