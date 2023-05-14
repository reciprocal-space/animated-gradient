import { CarouselContext } from "pure-react-carousel";
import { ConsoleLogger, Logger } from "./logger";
import { threadId } from "worker_threads";

//Converting colors to proper format
function normalizeColor(hexCode: number) {
    return [(hexCode >> 16 & 255) / 255, (hexCode >> 8 & 255) / 255, (255 & hexCode) / 255]
} 

["SCREEN", "LINEAR_LIGHT"].reduce((hexCode, t, n) => Object.assign(hexCode, {
    [t]: n
}), {});

class MiniGL {
    canvas: HTMLCanvasElement;
    width: number;
    height: number
    debug: boolean;

    constructor(canvas: HTMLCanvasElement, width: number, height: number, debug: boolean, logger: Logger) {
        this.canvas = canvas;
        this.canvas.getContext("webgl", { antialias: true });
        this.meshes = [];
        

        const debug_output = -1 !== document.location.search.toLowerCase().indexOf("debug=webgl");
        _miniGl.lastDebugMsg, _miniGl.debug = debug && debug_output ? 
            function (e) {
                const datetime = new Date;
                datetime - _miniGl.lastDebugMsg > 1e3 && console.log("---")
                console.log(`${datetime.toLocaleTimeString()}${Array(Math.max(0, 32 - e.length)).join("")}${e}: `, ...Array.from(arguments).slice(1));
                _miniGl.lastDebugMsg = datetime;
            } : 
            () => {};
        const context = _miniGl.gl;
        width && height && this.setSize(width, height);
    };

    setSize(width = 640, height = 480) {
        this.width = width;
        this.height = height;
        
        this.canvas.width = width;
        this.canvas.height = height;

        this.gl.viewport(0, 0, width, height);

        this.commonUniforms.resolution.value = [width, height];
        this.commonUniforms,aspectRatio.value = width / height;

        this.debug("MiniGL.setSize", { width, height });
    };
};

class Material {
    context: WebGLRenderingContext
    logger: Logger
    program: WebGLProgram

    constructor(vertexShaders, fragments, uniforms, context: WebGLRenderingContext, logger: Logger, webGlWrapper: WebGLProgram) {
        this.context = context
        this.logger = logger

        this.uniforms = uniforms
        this.uniformsInstances = []

        const prefix = "\n              precision highp float;\n            "
        this.vertexSource = `\n              ${prefix}\n              attribute vec4 position;\n              attribute vec2 uv;\n              attribute vec2 uvNorm;\n              ${this.getUniformVariableDeclarations(webGlWrapper.commonUniforms,"vertex")}\n              ${this.getUniformVariableDeclarations(uniforms,"vertex")}\n              ${vertexShaders}\n            `
        this.Source = `\n              ${prefix}\n              ${this.getUniformVariableDeclarations(program.commonUniforms,"fragment")}\n              ${this.getUniformVariableDeclarations(uniforms,"fragment")}\n              ${fragments}\n            `
        this.vertexShader = this.getShaderByType(context.VERTEX_SHADER, this.vertexSource)
        this.fragmentShader = getShaderByType(context.FRAGMENT_SHADER, this.Source)
        this.program = context.createProgram()
        context.attachShader(this.program, this.vertexShader)
        context.attachShader(this.program, this.fragmentShader)
        // TODO: can we separate the pure objects from application code? e.g. move this linking into a wrapper or Program
        context.linkProgram(this.program)
        if (!context.getProgramParameter(this.program, context.LINK_STATUS)) {
            const programInfo = context.getProgramInfoLog(this.program)
            this.logger.error(programInfo)
        }
        context.useProgram(this.program)
        // TODO: this could be in the application
        this.attachUniforms(void 0, webGlWrapper.commonUniforms)
        this.attachUniforms(void 0, this.uniforms)
    }

    // TODO: could also be in the application code
    attachUniforms(name, uniforms) {
        // TODO: turn this into a switch statement?
        void 0 === name
            ? Object.entries(uniforms).forEach(([name, uniform]) => this.attachUniforms(name, uniform)) // No idea what the deal with this is
            : "array" == uniforms.type 
                ? uniforms.value.forEach((uniform, i) => this.attachUniforms(`${name}[${i}]`, uniform))
                : "struct" == uniforms.type 
                    ? Object.entries(uniforms.value).forEach(([uniform, i]) => this.attachUniforms(`${name}.${uniform}`, i))
                    : this.logger.debug(JSON.stringify({ name, uniforms }))
        this.uniformInstances.push({ uniform, location: this.context.getUniformLocation(this.program, name) })



    }

    private getShaderByType(type: number, source: WebGLShader): WebGLShader {
        this.logger.debug(JSON.stringify(source))

        const shader = this.context.createShader(type)
        this.context.shaderSource(shader, source)
        this.context.compileShader(shader)
        
        if (!this.context.getShaderParameter(shader, this.context.COMPILE_STATUS)) {
            this.logger.error('Could not compile shader for program; type: ', type)
            // TODO: establish whether we should also throw an error
        }
        
        return shader
    }

    // TODO: can we move uniform assignments to a Uniforms class
    private getUniformVariableDeclarations(uniforms, type) {
        return Object.entries(uniforms).map([uniform, value] => value.getDeclaration(uniform, type)).join('\n')
    }
}

// Uniform variables are used to pass data from an application to webgl shaders
class Uniform {
    // what are the actual values here? value can be an array? what is type?
    context: WebGLRenderingContext
    type: string;
    typeFn: string;
    // typeFn: Record<string, string>

    static typeFn = {
        float: '1f',
        int: '1i',
        vec2: '2fv',
        vec3: '3fv',
        vec4: '4fv',
        mat4: 'Matrix4fv'
    }


    constructor(name, context) {
        this.context = context
        this.type = 'float'
        this.name = name
        // whats going on here?
        this.typeFn = Uniform.typeFn[this.type] || '1f'
        this.value = this.type || '1f'
        this.update()
    }

    update(value) {
        // Update method is responsible for updating the value of a uniform variable in a webgl program
        if (this.value !== undefined) {
            const methodName = `uniform${this.typeFn}`
            const method = this.context[methodName]

            if (method) {
                const args = [this.value]
                if (this.typeFn.startsWith('Matrix')) {
                    args.push(this.transpose)
                    args.push(null)
                }
                method.apply(args)
            }
        }
    }

    getDeclaration(name, type, length) {
        if (this.excludeFrom !== type) {
            // TODO: change this so that we aren't returning dynamic results
            if (this.type === 'array') {
                return this.value[0].getDaclaration(name, type, this.value.length) + `\nconst int ${name}_length = ${uniform.value.length}`
            }

            if (this.type === 'struct') {
                const nameWithoutPrefix = name.replace('u_', '')
                const modifiedNameWithoutPrefix = nameWithoutPrefix.toUpperCase() + nameWithoutPrefix.slice(1);
                return `uniform struct ${modifiedNameWithoutPrefix} \n{\n` + 
                    Object.entries(this.value).map(([name, uniform]) => 
                        uniform.getDeclaration(name, type).replace(/^uniform/, '')
                    ).join('')
                + `\n} ${name}${length > 0 ? `[${length}]` : ''}`
            }

            return `uniform ${this.type} ${name}${length > 0 ? `[${length}]` : ''}`
        }
    }
    
}