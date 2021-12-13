const path = require( 'path' );
const fs = require( 'fs' );
less = require("less");
const mkdir = require( '../node_modules/node-fs/lib/fs.js' );

const { constants, promises: { access } } = require('fs');

class CCCLessCompiler {

  constructor( state, less_input_path, settings = {
    less_file_extension:                 '.less',
    css_file_extension:                  '.css',
    sourcemap_file_extension:            'less.sourcemap',
    success_display_time:                0,
    no_output_display_time:              0,
    should_compress:                     true,
    should_notify_success:               true,
    should_use_input_root_directory:     true,
    less_input_directory_relative_paths: ['style', 'component'],
    should_use_system_root:              false,
    css_output_directory_path:           '/compiled_css',
    should_create_sourcemap:             true,
    should_inline_sourcemap:             true,
    should_create_file_for_empty_output: true
  } ) {

    this.loadConfigSettings(settings);
    this.initPaths( less_input_path );

  }

  loadConfigSettings( settings ) {
    this.settings = settings;
  }

  initPaths( less_input_path ) {

    if ( ! less_input_path.endsWith( this.settings.less_file_extension ) ) {
      this.valid = false;
      let error_message = this.less_input_path + " is not a .less file.";
      this.notify( error_message );
    }
    else {
      this.valid = true;
      this.initInputPath( less_input_path );
      this.initOutputPath();
      this.initSourcemap();
    }
  }

  initInputPath( less_input_path ) {
    this.less_input_path = less_input_path;
    this.input_directory = path.dirname( this.less_input_path );
    this.input_filename = path.basename( this.less_input_path );
  }

  initOutputPath() {

    this.output_filename = this.input_filename.replace(
                             this.settings.less_file_extension,
                             this.settings.css_file_extension
                           );

    if ( this.settings.css_output_directory_path.startsWith('/') )
      this.initRootRelativeOutputPath();
    else
      this.initFileRelativeOutputPath();

    this.css_output_path = path.join(
      this.css_output_directory_path,
      this.output_filename
    );
  }

  initRootRelativeOutputPath() {
    if ( this.settings.should_use_system_root )
      // If we should use system root and our path starts with '/'
      // then we can simply use the provided path.
      this.css_output_directory_path = this.settings.css_output_directory_path;
    else
      this.initProjectRelativeOutputPath();
  }

  initProjectRelativeOutputPath() {

    this.project_root_path = this.projectRootPath();

    this.css_output_directory_path = path.join(
      this.project_root_path,
      this.settings.css_output_directory_path
    );

    if ( this.settings.should_use_input_root_directory )
      this.initProjectRelativeOutputPathForInputRootDirectory();
  }

  trimStartingSlash( path_string ) {
    return ( path_string[ 0 ] == '/' )
         ? this.trimStartingSlash( path_string.substr( 1, path_string.length - 1 ) )
         : path_string;
  }

  trimTrailingSlash( path_string ) {
    return ( path_string[ path_string.length - 1 ] == '/' )
         ? this.trimTrailingSlash( path_string.substr( 0, path_string.length - 1 ) )
         : path_string;
  }

  trimSlash( path_string ) {
    let trimmed_path = this.trimStartingSlash( this.trimTrailingSlash( path_string ) );
    return trimmed_path;
  }

  matchPathStart( path_start_string, path_string ) {

    return matched;
  }

  pathRemainder( path_start_string, path_string ) {

    path_start_string = this.trimSlash( path_start_string );
    path_string = this.trimStartingSlash( path_string );

    let match_path_start_string = path_string.substr(
                                    0,
                                    path_start_string.length
                                  );
    let matched = match_path_start_string == path_start_string;

    let sliced_string  = matched
                       ? path_string.substr(
                           path_start_string.length,
                           path_string.length - path_start_string.length )
                       : path_string;
    let result_string = this.trimStartingSlash( sliced_string );
    return result_string;
  }

  initProjectRelativeOutputPathForInputRootDirectory() {
    // now we need to subtract project root from the path for current dir

    // slice root
    let path_without_project_root  = this.pathRemainder(
                                       this.project_root_path,
                                       this.input_directory
                                     );

    // test for style dir => slice off

    let relative_output_path = path_without_project_root;
    for ( this_less_input_dir of this.settings.less_input_directory_relative_paths ) {

      relative_output_path   = this.pathRemainder(
                                 this_less_input_dir,
                                 path_without_project_root
                               );
      if ( relative_output_path != path_without_project_root )
        break;
    }

    // use result
    this.nested_output_directory = relative_output_path;

    this.css_output_directory_path = path.join(
      this.css_output_directory_path,
      this.nested_output_directory
    );
  }

  initFileRelativeOutputPath() {
    this.css_output_directory_path = path.join(
      this.input_directory,
      this.settings.css_output_directory_path
    );
  }

  // Find the folder included in project that is root for this editor.
  // Ex: open /path/to/source_directory in project,
  //     editing source_directory/nested/path/to/some_class.js
  //     We want /path/to/source_directory.
  projectRootPath() {
    let cwd = undefined;
    while ( cwd = process.cwd() ) {
      try {
        let look_for_package_json = cwd + '/package.json'
        await access(look_for_package_json, constants.F_OK);
        break;
      } catch ( access_err ) {
        try {
          process.chdir('..');
        } catch ( chdir_err ) {
          console.error(chdir_err);
        }
      }
    }
    return cwd;
  }

  initSourcemap() {
    this.sourcemap_output_path = this.css_output_path
                               + this.settings.sourcemap_file_extension;
  }

  compile( file_path ) {
    delete this.output;
    this.loadConfigSettings();
    this.initPaths( file_path );
    return this.valid
         ? fs.readFile(
             this.less_input_path,
             'utf-8',
             ( error, less_content ) => { this.parse( error, less_content ) }
           )
         : false;
  }

  handleFileError( error, less_input ) {
    console.error(error);
  }

  parse( error, less_input ) {

    if ( error )
      this.handleFileError( error, less_input );

    else {
      let options = {
        relativeUrls: true,
        filename:     this.less_input_path
      };
      if ( this.settings.should_create_sourcemap )
        options["sourceMap"] = this.settings.should_inline_sourcemap
                          ? { sourceMapFileInline: true }
                          : {};

      let self = this;
      less.render( less_input, options )
          .then(   (output) => { self.renderDidFinish(output) } )
          .catch(  (error) => { self.notify(error.message) } );
    }

  }

  renderDidFinish( output ) {
    /*
       output.css = string of css
       output.map = string of sourcemap
       output.imports = array of string filenames of the imports referenced
    */
    this.output = output;

    if ( ! this.output.css
      && ! this.settings.should_create_file_for_empty_output
      && ! fs.existsSync( this.css_output_path ) ) {
      this.notifyNoOutput();
    }
    else
      this.outputFile();
  }

  outputFile() {
    mkdir.mkdir( this.css_output_directory_path, 0744, true, ( error ) => {
      if ( error )
        this.notify( error );
      else
        this.writeToDestination();
    });
  }

  writeToDestination () {
    fs.writeFile(
       this.css_output_path,
       this.output.css,
       ( error ) => { this.notify( error ) }
     );

    if ( this.settings.should_create_sourcemap && ! this.settings.should_inline_sourcemap )
      fs.writeFile(
         this.sourcemap_output_path,
         this.output.map,
         ( error ) => { this.notify( error ) }
       );
  }

  notify( error ) {

    if ( error )
      this.notifyError( error );

    else if ( this.settings.should_notify_success )
      this.notifySuccess();

  }

  notifySuccess() {
    console.error( this.less_input_path + ' => ' + this.css_output_path);
  }

  notifyNoOutput() {
    console.error( 'No output for ' + this.less_input_path);
  }

  notifyError( error ) {
    console.error(error);
  }

  showPanel( display_time ) {
    this.modal_panel.show();
    let modal_panel = this.modal_panel;
    setTimeout( () => { modal_panel.hide(); }, display_time );
  }

}

export default CCCLessCompiler;
