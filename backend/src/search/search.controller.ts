import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(
    @Query('q') q?: string,
    @Query('sort') sort?: string,
    @Query('type') type?: string,
  ) {
    return this.searchService.search({ q, sort, type });
  }
}
